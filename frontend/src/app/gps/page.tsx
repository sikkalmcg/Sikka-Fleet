'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Shield,
  Key,
  Globe,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Clock,
  Truck,
  Zap,
  Navigation,
  Compass,
  Search,
  ExternalLink,
  Plus,
  Edit3,
  Calendar,
  Building2,
  ChevronRight,
  User,
} from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import Modal from '../../components/Modal';
import AlertBanner, { AlertState } from '../../components/AlertBanner';
import { apiRequest } from '../../lib/api';
import { formatDateTime, formatDistance } from '../../lib/formatters';
import { useAuth } from '../../lib/authContext';

interface LiveVehicleItem {
  vehicleNumber: string;
  vehicleId: string | null;
  driverName: string;
  mobile: string;
  deviceNumber: string;
  vendorName: string;
  vehicleType: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean;
  angle: number;
  chargeOn: boolean;
  timestamp: string;
  readableTime: string;
  geofence: {
    status: 'Inside' | 'Outside';
    plantName: string;
    distanceMeter: number;
    nearestPlant: string;
  };
  loadingPlan: {
    currentPlan: string;
    authorName: string;
    createdAt: string | null;
    history: Array<{
      planText: string;
      authorName: string;
      createdAt: string;
    }>;
  };
}

interface GpsSettingData {
  _id?: string;
  provider: string;
  apiUrl: string;
  status: 'Active' | 'Inactive';
  connectionStatus: 'Connected' | 'Connection Failed' | 'Pending';
  lastSync?: string | null;
  lastError?: string | null;
  pollIntervalSeconds: number;
  hasApiKey: boolean;
  maskedApiKey: string;
  hasApiSecret: boolean;
  updatedAt?: string;
}

export default function GpsPage() {
  const { user } = useAuth();

  // Settings state
  const [setting, setSetting] = useState<GpsSettingData | null>(null);
  const [formData, setFormData] = useState({
    provider: 'WheelsEye GPS',
    apiUrl: 'https://api.wheelseye.com/currentLoc?accessToken=53afc208-0981-48c7-b134-d85d2f33dc0c',
    apiKey: '53afc208-0981-48c7-b134-d85d2f33dc0c',
    apiSecret: '',
    status: 'Active' as 'Active' | 'Inactive',
    pollIntervalSeconds: 15,
  });

  // Live vehicles state
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicleItem[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<LiveVehicleItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'moving' | 'stopped'>('all');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  // Plan modal state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planInput, setPlanInput] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planError, setPlanError] = useState('');

  // Fetch Live Vehicles from API
  const fetchLiveVehicles = useCallback(async (quiet = false) => {
    if (!quiet) setIsLiveLoading(true);
    try {
      const res = await apiRequest<{
        totalCount: number;
        provider: string;
        apiUrl: string;
        lastSync: string;
        vehicles: LiveVehicleItem[];
      }>('/gps/live-vehicles');

      const vehs = res.vehicles || [];
      setLiveVehicles(vehs);

      // Keep current selection or default to first vehicle
      setSelectedVehicle((prev) => {
        if (!prev) return vehs[0] || null;
        const found = vehs.find((v) => v.vehicleNumber === prev.vehicleNumber);
        return found || vehs[0] || null;
      });
    } catch (err: any) {
      if (!quiet) {
        setAlert({
          type: 'error',
          message: err.message || 'Failed to fetch live vehicle telemetry from WheelsEye API.',
        });
      }
    } finally {
      if (!quiet) setIsLiveLoading(false);
    }
  }, []);

  // Fetch GPS Configuration
  const fetchGpsSetting = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<GpsSettingData>('/gps');
      setSetting(data);
      setFormData({
        provider: data.provider || 'WheelsEye GPS',
        apiUrl:
          data.apiUrl ||
          'https://api.wheelseye.com/currentLoc?accessToken=53afc208-0981-48c7-b134-d85d2f33dc0c',
        apiKey: data.maskedApiKey || '',
        apiSecret: data.hasApiSecret ? '••••••••••••' : '',
        status: data.status || 'Active',
        pollIntervalSeconds: data.pollIntervalSeconds || 15,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'GPS service temporarily unavailable.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGpsSetting();
    fetchLiveVehicles(false);

    // Live refresh every 20 minutes (1,200,000 ms)
    const interval = setInterval(() => {
      fetchLiveVehicles(true);
    }, 20 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchGpsSetting, fetchLiveVehicles]);

  // Handle Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!formData.provider.trim()) {
      setAlert({ type: 'error', message: 'GPS Provider is required.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiRequest<{ message: string; setting: GpsSettingData }>('/gps', {
        method: 'POST',
        body: JSON.stringify({
          provider: formData.provider.trim(),
          apiUrl: formData.apiUrl.trim(),
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          status: formData.status,
          pollIntervalSeconds: Number(formData.pollIntervalSeconds) || 15,
        }),
      });

      setAlert({
        type: 'success',
        message: 'GPS configuration saved successfully.',
      });
      setSetting(res.setting);
      fetchLiveVehicles(false);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Unable to connect to GPS provider.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setAlert(null);
    try {
      const res = await apiRequest<{
        status: 'Connected' | 'Connection Failed';
        message: string;
        lastSync?: string;
      }>('/gps/test-connection', {
        method: 'POST',
      });
      if (res.status === 'Connected') {
        setAlert({
          type: 'success',
          message: res.message,
        });
        fetchLiveVehicles(false);
      } else {
        setAlert({
          type: 'error',
          message: res.message || 'Unable to connect to GPS provider.',
        });
      }
      fetchGpsSetting();
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Unable to connect to GPS provider.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Open Plan Modal for selected vehicle
  const openPlanModal = () => {
    if (!selectedVehicle) return;
    setPlanError('');
    setPlanInput(selectedVehicle.loadingPlan?.currentPlan || '');
    setIsPlanModalOpen(true);
  };

  // Save Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !selectedVehicle.vehicleId) {
      setPlanError('Vehicle is still synchronizing with database. Please try again in a moment.');
      return;
    }

    if (!planInput.trim()) {
      setPlanError('Please enter a loading plan description.');
      return;
    }

    setIsSavingPlan(true);
    try {
      await apiRequest(`/dashboard/vehicles/${selectedVehicle.vehicleId}/plan`, {
        method: 'POST',
        body: JSON.stringify({ planText: planInput.trim() }),
      });

      setIsPlanModalOpen(false);
      setAlert({
        type: 'success',
        message: `Plan saved for vehicle ${selectedVehicle.vehicleNumber}.`,
      });
      fetchLiveVehicles(true);
    } catch (err: any) {
      setPlanError(err.message || 'Failed to save loading plan.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Filtered vehicles for left side
  const filteredVehicles = liveVehicles.filter((v) => {
    const matchesSearch = v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (statusFilter === 'moving') return v.speed > 0;
    if (statusFilter === 'stopped') return v.speed === 0;
    return true;
  });

  return (
    <AppLayout pageTitle="GPS Telematics Integration" requiredPage="GPS">
      <div className="space-y-6">
        {/* Top Control Bar (Title removed as requested) */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Live WheelsEye GPS • Auto-sync every 20 minutes</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchLiveVehicles(false)}
              disabled={isLiveLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin' : ''}`} />
              <span>{isLiveLoading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{showConfig ? 'Hide Config' : 'API Config'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />

        {/* Top Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              API Provider
            </span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block truncate">
              {setting?.provider || 'WheelsEye GPS'}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Active Streams
            </span>
            <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
              {liveVehicles.length} Live Vehicles
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Connection Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">Connected</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Last Sync
            </span>
            <span className="text-xs font-bold text-slate-700 mt-0.5 block truncate">
              {formatDateTime(setting?.lastSync || new Date())}
            </span>
          </div>
        </div>

        {/* Collapsible API Provider Configuration Form */}
        {showConfig && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                WheelsEye API Integration Settings
              </h2>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <PlayCircle className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Provider Name *
                  </label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:border-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    API Endpoint URL *
                  </label>
                  <input
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    placeholder="https://api.wheelseye.com/currentLoc?accessToken=..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    API Key / Access Token
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="53afc208-0981-48c7-b134-d85d2f33dc0c"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save API Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MAIN SPLIT VIEW: Left Side Vehicle List & Right Side Current Loading / Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT SIDE: Vehicle List from API */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden max-h-[780px]">
            {/* Left Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    API Vehicles ({liveVehicles.length})
                  </h2>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select to View
                </span>
              </div>

              {/* Search input */}
              <div className="relative rounded-xl border border-slate-300 bg-white focus-within:border-emerald-500 flex items-center mb-2.5">
                <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vehicle number (e.g. UP14HT)..."
                  className="w-full px-3 py-2 text-xs font-bold uppercase tracking-wider focus:outline-hidden placeholder:font-normal placeholder:capitalize"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({liveVehicles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('moving')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'moving'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Moving ({liveVehicles.filter((v) => v.speed > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('stopped')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    statusFilter === 'stopped'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Stopped ({liveVehicles.filter((v) => v.speed === 0).length})
                </button>
              </div>
            </div>

            {/* Scrollable Vehicle List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-2">
              {filteredVehicles.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No vehicles match filter</p>
                </div>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected = selectedVehicle?.vehicleNumber === v.vehicleNumber;
                  const isMoving = v.speed > 0;
                  const hasPlan = Boolean(v.loadingPlan?.currentPlan);

                  return (
                    <button
                      key={v.vehicleNumber}
                      type="button"
                      onClick={() => setSelectedVehicle(v)}
                      className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer mb-1 flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-2 border-emerald-500 shadow-xs'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 tracking-wide">
                            {v.vehicleNumber}
                          </span>
                          {/* Ignition Pill */}
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              v.ignition
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                v.ignition ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {v.ignition ? 'IGN ON' : 'IGN OFF'}
                          </span>
                        </div>

                        {/* Vendor & Status */}
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate font-medium">
                          {v.vendorName} • {v.vehicleType}
                        </p>

                        {/* Geofence & Plan status */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              v.geofence.status === 'Inside'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {v.geofence.status === 'Inside'
                              ? `Inside ${v.geofence.plantName}`
                              : 'Outside Plants'}
                          </span>

                          {hasPlan ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              Plan Set
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-slate-400 bg-slate-100">
                              No Plan
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Speed badge */}
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isMoving
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isMoving ? `${Math.round(v.speed)} km/h` : 'Stopped'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1 font-mono">
                          {v.readableTime?.split(',')[1] || ''}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE: Current Loading & Live Telemetry Details */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-4">
            {!selectedVehicle ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
                <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No Vehicle Selected</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click any vehicle from the list on the left to inspect its live loading and telemetry.
                </p>
              </div>
            ) : (
              <>
                {/* Vehicle Header Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-emerald-500/20 shrink-0">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                          {selectedVehicle.vehicleNumber}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            selectedVehicle.speed > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {selectedVehicle.speed > 0
                            ? `Moving (${Math.round(selectedVehicle.speed)} km/h)`
                            : 'Stopped / Idle'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Vendor: <strong className="text-slate-800">{selectedVehicle.vendorName}</strong> • Type: <strong className="text-slate-800">{selectedVehicle.vehicleType}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Direct Map Link */}
                  <a
                    href={`https://maps.google.com/?q=${selectedVehicle.latitude},${selectedVehicle.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>View on Google Maps</span>
                  </a>
                </div>

                {/* CURRENT LOADING / DISPATCH PLAN CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 opacity-80" />

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Current Loading &amp; Dispatch Plan</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Commercial dispatch instructions, loading plant destination, and materials
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openPlanModal}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                        selectedVehicle.loadingPlan?.currentPlan
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                      }`}
                    >
                      {selectedVehicle.loadingPlan?.currentPlan ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Loading Plan</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Loading Plan</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Active Plan Display */}
                  {selectedVehicle.loadingPlan?.currentPlan ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-slate-900">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>
                              {selectedVehicle.loadingPlan.history.length > 1 ? 'New Plan' : 'Plan'} by{' '}
                              {selectedVehicle.loadingPlan.authorName || 'Dispatcher'}
                            </span>
                          </span>
                          <span className="font-mono">
                            {formatDateTime(selectedVehicle.loadingPlan.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 leading-relaxed">
                          {selectedVehicle.loadingPlan.currentPlan}
                        </p>
                      </div>

                      {/* Older Revision History */}
                      {selectedVehicle.loadingPlan.history.length > 1 && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            Previous Plan Audit Trail
                          </span>
                          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                            {selectedVehicle.loadingPlan.history
                              .slice(0, -1)
                              .reverse()
                              .map((oldPlan, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700"
                                >
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                                    <span>Old Plan by {oldPlan.authorName}</span>
                                    <span>{formatDateTime(oldPlan.createdAt)}</span>
                                  </div>
                                  <p className="font-medium italic text-slate-800">
                                    {oldPlan.planText}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-600">
                        No loading plan currently assigned for this vehicle.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Click the button above to specify loading destination (e.g. &ldquo;This vehicle will load for Ghaziabad&rdquo;).
                      </p>
                    </div>
                  )}
                </div>

                {/* LIVE TELEMETRY SENSOR GRID */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span>Live GPS Telemetry &amp; Sensors</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Coordinates (Lat, Lon)
                      </span>
                      <span className="font-mono font-bold text-slate-800 mt-1 block">
                        {selectedVehicle.latitude.toFixed(6)}, {selectedVehicle.longitude.toFixed(6)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Current Speed
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                        {Math.round(selectedVehicle.speed)} km/h
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Ignition Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-bold">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selectedVehicle.ignition ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span className={selectedVehicle.ignition ? 'text-emerald-700' : 'text-slate-600'}>
                          {selectedVehicle.ignition ? 'Ignition ON' : 'Ignition OFF'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Heading / Compass
                      </span>
                      <span className="font-bold text-slate-800 mt-1 block">
                        {selectedVehicle.angle}° Angle
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Device / IMEI
                      </span>
                      <span className="font-mono text-slate-700 mt-1 block truncate">
                        {selectedVehicle.deviceNumber}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Telemetry Time
                      </span>
                      <span className="font-medium text-slate-800 mt-1 block truncate">
                        {selectedVehicle.readableTime || formatDateTime(selectedVehicle.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GEOFENCE PROXIMITY CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Geofence Proximity &amp; Plant Perimeter</span>
                  </h3>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Plant Boundary Status
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                        {selectedVehicle.geofence.status === 'Inside'
                          ? `Currently Inside ${selectedVehicle.geofence.plantName}`
                          : 'Outside All Configured Plants'}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Nearest Plant Distance
                      </span>
                      <span className="text-xs font-bold text-emerald-700 mt-0.5 block">
                        {formatDistance(selectedVehicle.geofence.distanceMeter)} to{' '}
                        {selectedVehicle.geofence.nearestPlant || 'Salt Plant'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal: Add or Edit Loading Plan */}
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => !isSavingPlan && setIsPlanModalOpen(false)}
          title={
            selectedVehicle?.loadingPlan?.currentPlan
              ? `Edit Loading Plan – ${selectedVehicle?.vehicleNumber}`
              : `Add Loading Plan – ${selectedVehicle?.vehicleNumber}`
          }
          subtitle={`Plan author: ${user?.fullName || 'User'} (@${user?.username || 'user'})`}
          maxWidth="md"
        >
          {planError && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{planError}</span>
            </div>
          )}

          <form onSubmit={handleSavePlan} className="space-y-4">
            {/* Show previous plan history */}
            {selectedVehicle?.loadingPlan?.currentPlan && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-32 overflow-y-auto space-y-1 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Current Plan
                </span>
                <p className="text-xs text-slate-800 font-semibold">
                  {selectedVehicle.loadingPlan.currentPlan}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  By {selectedVehicle.loadingPlan.authorName} ({formatDateTime(selectedVehicle.loadingPlan.createdAt)})
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {selectedVehicle?.loadingPlan?.currentPlan
                  ? 'New Loading Plan (approx. 20 words) *'
                  : 'Loading Plan (approx. 20 words) *'}
              </label>
              <textarea
                rows={3}
                value={planInput}
                onChange={(e) => setPlanInput(e.target.value)}
                placeholder="e.g. This vehicle will load for Ghaziabad / Delhi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:border-emerald-500 focus:outline-hidden"
                disabled={isSavingPlan}
                required
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Example: &ldquo;This vehicle will load for Ghaziabad&rdquo;</span>
                <span>{planInput.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                disabled={isSavingPlan}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPlan}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingPlan ? 'Saving...' : 'Save Loading Plan'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
