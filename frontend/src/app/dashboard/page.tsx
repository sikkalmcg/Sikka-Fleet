'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Navigation,
  Truck,
  RefreshCw,
  Compass,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  FileSpreadsheet,
  Plus,
  Edit3,
} from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import Modal from '../../components/Modal';
import AlertBanner, { AlertState } from '../../components/AlertBanner';
import { apiRequest } from '../../lib/api';
import { formatDateTime, formatDistance } from '../../lib/formatters';
import { useAuth } from '../../lib/authContext';

export interface VehiclePlanItem {
  planText: string;
  authorName: string;
  authorUsername?: string;
  createdAt: string;
}

interface PlantWidget {
  id: string;
  name: string;
  location: string;
  radiusMeter: number;
  latitude: number;
  longitude: number;
  vehicleCount: number;
  isOutside: boolean;
}

interface PlantVehicle {
  id: string;
  vehicleNumber: string;
  driverName: string;
  mobile: string;
  fleetType: string;
  ownerName?: string;
  entryDateTime: string;
  latitude: number;
  longitude: number;
  distanceMeter?: number;
  status: string;
  plans?: VehiclePlanItem[];
}

interface OutsideVehicle {
  id: string;
  vehicleNumber: string;
  driverName: string;
  mobile: string;
  fleetType: string;
  ownerName?: string;
  lastLocationTime: string;
  latitude: number;
  longitude: number;
  status: string;
}

export default function DashboardPage() {
  const [plantWidgets, setPlantWidgets] = useState<PlantWidget[]>([]);
  const [outsideWidget, setOutsideWidget] = useState<{
    id: string;
    name: string;
    vehicleCount: number;
    isOutside: boolean;
  } | null>(null);
  const [totalActiveVehicles, setTotalActiveVehicles] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  // Drilldown Modal State
  const [activeModal, setActiveModal] = useState<'plant' | 'outside' | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<PlantWidget | null>(null);
  const [plantVehicles, setPlantVehicles] = useState<PlantVehicle[]>([]);
  const [outsideVehicles, setOutsideVehicles] = useState<OutsideVehicle[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Plan Management Modal State
  const { user } = useAuth();
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedVehicleForPlan, setSelectedVehicleForPlan] = useState<PlantVehicle | null>(null);
  const [planInput, setPlanInput] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planError, setPlanError] = useState('');

  // Helper to escape HTML characters for Excel table XML/HTML
  const escapeXml = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Export Plant Vehicles list to .xls Excel file via server download
  const exportPlantVehiclesToExcel = () => {
    if (!selectedPlant) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('sikka_fleet_token') || '' : '';
    const downloadUrl = `http://localhost:5000/api/dashboard/plants/${selectedPlant.id}/export?token=${encodeURIComponent(token)}`;
    window.location.href = downloadUrl;
  };

  // Export Outside Vehicles to .xls via server download
  const exportOutsideVehiclesToExcel = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sikka_fleet_token') || '' : '';
    const downloadUrl = `http://localhost:5000/api/dashboard/outside/export?token=${encodeURIComponent(token)}`;
    window.location.href = downloadUrl;
  };

  // Open Add/Edit Plan Modal for a Vehicle
  const openPlanModal = (v: PlantVehicle) => {
    setSelectedVehicleForPlan(v);
    setPlanError('');
    // If editing, start with empty input or existing plan so user can write updated plan
    const latestPlan = v.plans && v.plans.length > 0 ? v.plans[v.plans.length - 1] : null;
    setPlanInput(latestPlan ? latestPlan.planText : '');
    setIsPlanModalOpen(true);
  };

  // Handle Save Plan Submission
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForPlan) return;
    setPlanError('');

    if (!planInput.trim()) {
      setPlanError('Please enter a plan description.');
      return;
    }

    setIsSavingPlan(true);
    try {
      const res = await apiRequest<{
        message: string;
        plan: VehiclePlanItem;
        plans: VehiclePlanItem[];
      }>(`/dashboard/vehicles/${selectedVehicleForPlan.id}/plan`, {
        method: 'POST',
        body: JSON.stringify({ planText: planInput.trim() }),
      });

      // Update in local plantVehicles state immediately
      setPlantVehicles((prev) =>
        prev.map((v) =>
          v.id === selectedVehicleForPlan.id ? { ...v, plans: res.plans } : v
        )
      );

      setIsPlanModalOpen(false);
      setSelectedVehicleForPlan(null);
      setAlert({
        type: 'success',
        message: `Plan saved for vehicle ${selectedVehicleForPlan.vehicleNumber}.`,
      });
    } catch (err: any) {
      setPlanError(err.message || 'Failed to save dispatch plan.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Fetch Dashboard Summary
  const fetchSummary = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const data = await apiRequest<{
        plantWidgets: PlantWidget[];
        outsideWidget: { id: string; name: string; vehicleCount: number; isOutside: boolean };
        totalActiveVehicles: number;
        lastUpdated: string;
      }>('/dashboard/summary');

      setPlantWidgets(data.plantWidgets || []);
      setOutsideWidget(data.outsideWidget);
      setTotalActiveVehicles(data.totalActiveVehicles || 0);
      setLastUpdated(data.lastUpdated);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to load fleet monitoring summary.',
      });
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(true);

    // Auto-refresh summary every 20 minutes (1,200,000 ms)
    const interval = setInterval(() => {
      fetchSummary(false);
    }, 20 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Handle Manual GPS Sync Trigger
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setAlert(null);
    try {
      const result = await apiRequest<{ message: string; processedCount?: number }>('/gps/trigger-sync', {
        method: 'POST',
      });
      setAlert({
        type: 'success',
        message: `${result.message || 'GPS synchronization completed.'} Evaluated positions for active vehicles.`,
      });
      await fetchSummary(false);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Unable to connect to GPS provider.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Click on a Plant Widget
  const handlePlantClick = async (plant: PlantWidget) => {
    setSelectedPlant(plant);
    setActiveModal('plant');
    setIsModalLoading(true);
    try {
      const data = await apiRequest<{
        plant: { id: string; name: string; location: string; radiusMeter: number };
        vehicles: PlantVehicle[];
      }>(`/dashboard/plants/${plant.id}/vehicles`);
      setPlantVehicles(data.vehicles || []);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to retrieve vehicles for this plant.',
      });
      setActiveModal(null);
    } finally {
      setIsModalLoading(false);
    }
  };

  // Click on the Outside Widget
  const handleOutsideClick = async () => {
    setActiveModal('outside');
    setIsModalLoading(true);
    try {
      const data = await apiRequest<{
        title: string;
        vehicles: OutsideVehicle[];
      }>('/dashboard/outside/vehicles');
      setOutsideVehicles(data.vehicles || []);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to retrieve outside vehicles.',
      });
      setActiveModal(null);
    } finally {
      setIsModalLoading(false);
    }
  };

  return (
    <AppLayout pageTitle="Fleet Monitoring Dashboard" requiredPage="Dashboard">
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Fleet Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last evaluated:</span>
              <strong className="text-slate-700">{formatDateTime(lastUpdated)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing GPS...' : 'Sync GPS Now'}</span>
            </button>
          </div>
        </div>

        {/* Alert Feedback */}
        <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />

        {/* Section Title */}
        <div className="pt-2">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Geofence Detection Widgets
          </h2>
          <p className="text-xs text-slate-500">
            Click any plant widget or the Outside widget to view detailed vehicle logs and entry timestamps
          </p>
        </div>

        {/* Dynamic Plant Widgets Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-white border border-slate-200 p-6 animate-pulse"
              >
                <div className="h-5 bg-slate-200 rounded w-1/2 mb-4" />
                <div className="h-10 bg-slate-100 rounded w-1/3 mb-4" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Dynamic Active Plants */}
            {plantWidgets.map((plant) => (
              <button
                key={plant.id}
                type="button"
                onClick={() => handlePlantClick(plant)}
                className="group flex flex-col justify-between text-left p-6 rounded-2xl bg-white hover:bg-slate-50/70 border border-slate-200/90 hover:border-emerald-500 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 opacity-80 group-hover:w-3 transition-all" />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition">
                        {plant.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Geofenced
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{plant.location}</span>
                  </p>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Radius: <strong className="text-slate-700">{plant.radiusMeter} meters</strong>
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition">
                      {plant.vehicleCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {plant.vehicleCount === 1 ? 'Vehicle' : 'Vehicles'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                    View Fleet &rarr;
                  </span>
                </div>
              </button>
            ))}

            {/* Outside Widget */}
            {outsideWidget && (
              <button
                type="button"
                onClick={handleOutsideClick}
                className="group flex flex-col justify-between text-left p-6 rounded-2xl bg-white hover:bg-slate-50/70 border border-slate-200/90 hover:border-amber-500 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 opacity-80 group-hover:w-3 transition-all" />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-amber-700 transition">
                        Outside
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Transit
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                    <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Outside all active plant geofences</span>
                  </p>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Coverage: <strong className="text-slate-700">En route / Open highway</strong>
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 group-hover:text-amber-600 transition">
                      {outsideWidget.vehicleCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {outsideWidget.vehicleCount === 1 ? 'Vehicle' : 'Vehicles'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">
                    View Fleet &rarr;
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Modal: Plant Vehicles Drilldown */}
        <Modal
          isOpen={activeModal === 'plant'}
          onClose={() => setActiveModal(null)}
          title={`${selectedPlant?.name || 'Plant'} – Vehicles`}
          subtitle={`Currently detected inside configured ${selectedPlant?.radiusMeter || 500}m geofence radius`}
          maxWidth="5xl"
        >
          {/* Modal Header Actions: Export to Excel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">
                Inside Plant: <strong className="text-slate-900">{plantVehicles.length} vehicles</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={exportPlantVehiclesToExcel}
              disabled={plantVehicles.length === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Download vehicles and plan history as Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>

          {isModalLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">Loading plant vehicles...</p>
            </div>
          ) : plantVehicles.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No vehicles inside this plant</p>
              <p className="text-xs text-slate-500 mt-0.5">
                No active GPS coordinates currently match this plant boundary.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 -my-2">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Vehicle Number</th>
                    <th className="px-5 py-3">Entry Date & Time</th>
                    <th className="px-5 py-3">Driver Name</th>
                    <th className="px-5 py-3">Fleet Type</th>
                    <th className="px-5 py-3">Distance From Center</th>
                    <th className="px-5 py-3 min-w-[260px]">Plan</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {plantVehicles.map((v) => {
                    const hasPlans = Array.isArray(v.plans) && v.plans.length > 0;
                    const latestPlan = hasPlans ? v.plans![v.plans!.length - 1] : null;
                    const olderPlans =
                      hasPlans && v.plans!.length > 1
                        ? v.plans!.slice(0, -1).reverse()
                        : [];

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-extrabold text-slate-900 text-sm tracking-wide">
                            {v.vehicleNumber}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 font-semibold whitespace-nowrap">
                          {formatDateTime(v.entryDateTime)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{v.driverName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <span>{v.mobile}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 whitespace-nowrap">
                            {v.fleetType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-emerald-700 font-bold whitespace-nowrap">
                          {formatDistance(v.distanceMeter)}
                        </td>

                        {/* Plan Column */}
                        <td className="px-5 py-3.5">
                          {!hasPlans ? (
                            <span className="text-slate-400 italic text-[11px]">
                              No plan assigned
                            </span>
                          ) : (
                            <div className="space-y-1.5 max-w-[280px]">
                              {/* Latest Plan */}
                              <div className="text-xs bg-emerald-50/90 p-2 rounded-lg border border-emerald-200/90 text-slate-800 shadow-2xs">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
                                  {v.plans!.length > 1 ? 'New Plan' : 'Plan'} by {latestPlan!.authorName} ({formatDateTime(latestPlan!.createdAt)}):
                                </span>
                                <p className="font-semibold text-slate-900 mt-0.5">
                                  {latestPlan!.planText}
                                </p>
                              </div>

                              {/* Older Plans History (Audit Trail) */}
                              {olderPlans.map((oldPlan, idx) => (
                                <div
                                  key={idx}
                                  className="text-[11px] bg-slate-50 p-1.5 rounded-md border border-slate-200 text-slate-600"
                                >
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block">
                                    Old Plan by {oldPlan.authorName} ({formatDateTime(oldPlan.createdAt)}):
                                  </span>
                                  <p className="italic text-slate-700 mt-0.5">
                                    {oldPlan.planText}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Action Column: Add Plan / Edit */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openPlanModal(v)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs ${
                              !hasPlans
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {!hasPlans ? (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Plan</span>
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Modal>

        {/* Modal: Add / Edit Dispatch Plan */}
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => !isSavingPlan && setIsPlanModalOpen(false)}
          title={
            selectedVehicleForPlan?.plans && selectedVehicleForPlan.plans.length > 0
              ? `Edit Dispatch Plan – ${selectedVehicleForPlan?.vehicleNumber}`
              : `Add Dispatch Plan – ${selectedVehicleForPlan?.vehicleNumber}`
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
            {/* If vehicle has previous plan history, show it */}
            {selectedVehicleForPlan?.plans && selectedVehicleForPlan.plans.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-36 overflow-y-auto space-y-1.5 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Existing Plan History
                </span>
                {selectedVehicleForPlan.plans.slice().reverse().map((p, idx) => (
                  <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-600 block">
                      {idx === 0 ? 'Current Plan' : `Previous Revision`} by {p.authorName} ({formatDateTime(p.createdAt)}):
                    </span>
                    <p className="text-slate-800 font-medium mt-0.5">{p.planText}</p>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {selectedVehicleForPlan?.plans && selectedVehicleForPlan.plans.length > 0
                  ? 'New Plan (approx. 20 words) *'
                  : 'Vehicle Plan (approx. 20 words) *'}
              </label>
              <textarea
                rows={3}
                value={planInput}
                onChange={(e) => setPlanInput(e.target.value)}
                placeholder="e.g. This vehicle will load for Ghaziabad"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:border-emerald-500 focus:outline-hidden"
                disabled={isSavingPlan}
                required
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Example: &ldquo;This vehicle will load for Ghaziabad&rdquo;</span>
                <span>
                  {planInput.trim().split(/\s+/).filter(Boolean).length} words
                </span>
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
                {isSavingPlan ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Outside Vehicles Drilldown */}
        <Modal
          isOpen={activeModal === 'outside'}
          onClose={() => setActiveModal(null)}
          title="Outside – Vehicles"
          subtitle="Registered vehicles whose latest GPS location is outside all active plant geofences"
          maxWidth="2xl"
        >
          {/* Outside Modal Header Actions: Export */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">
                Outside Geofences: <strong className="text-slate-900">{outsideVehicles.length} vehicles</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={exportOutsideVehiclesToExcel}
              disabled={outsideVehicles.length === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Download outside vehicles list as Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>

          {isModalLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-7 h-7 text-amber-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">Loading outside vehicles...</p>
            </div>
          ) : outsideVehicles.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">All vehicles are inside plants</p>
              <p className="text-xs text-slate-500 mt-0.5">
                No active registered vehicles are currently outside geofences.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 -my-2">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Vehicle Number</th>
                    <th className="px-6 py-3">Last Location Time</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Coordinates (Lat, Lon)</th>
                    <th className="px-6 py-3">Driver Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {outsideVehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-3.5">
                        <span className="font-extrabold text-slate-900 text-sm tracking-wide">
                          {v.vehicleNumber}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-700 font-semibold">
                        {formatDateTime(v.lastLocationTime)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Outside
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 font-mono text-[11px]">
                        {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-800">{v.driverName}</span>
                        <span className="block text-[11px] text-slate-400">{v.fleetType}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
