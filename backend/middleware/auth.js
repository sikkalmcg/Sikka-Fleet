const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'sikka_fleet_super_secret_jwt_key_2026';

const verifyToken = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    const user = await User.findById(decoded.userId).populate('accessPlants', 'plantName status');
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    res.status(500).json({ error: 'Authentication verification failed.' });
  }
};

const checkPageAccess = (pageName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Check if user has explicit access to this page
    if (!Array.isArray(req.user.accessPages) || !req.user.accessPages.includes(pageName)) {
      return res.status(403).json({
        error: `Access Denied: You do not have authorization to access '${pageName}'.`,
      });
    }

    next();
  };
};

const checkPlantAccess = (plantIdParamKey = 'plantId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const plantId = req.params[plantIdParamKey] || req.body[plantIdParamKey] || req.query[plantIdParamKey];
    if (!plantId) {
      return next();
    }

    // If user has specific plant assignments, verify that plantId is among them
    // Note: If an admin has all plants or explicit access, allow
    if (req.user.accessPlants && req.user.accessPlants.length > 0) {
      const allowedIds = req.user.accessPlants.map((p) => p._id.toString());
      if (!allowedIds.includes(plantId.toString())) {
        return res.status(403).json({
          error: 'Access Denied: You do not have authorization for this plant.',
        });
      }
    }

    next();
  };
};

module.exports = {
  JWT_SECRET,
  verifyToken,
  checkPageAccess,
  checkPlantAccess,
};
