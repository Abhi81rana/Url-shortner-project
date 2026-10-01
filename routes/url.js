const express = require("express");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
const UrlModel = require("../models/url");
const User = require("../models/user");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "shortener-dev-secret";

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeAlias(value) {
  return String(value || "").trim();
}

function validateAlias(alias) {
  if (!alias) return null;

  if (!/^[A-Za-z0-9_-]{4,20}$/.test(alias)) {
    return "Alias must be 4 to 20 characters using letters, numbers, '-' or '_' only.";
  }

  return null;
}

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    return user;
  } catch (error) {
    return null;
  }
}

function requireUser(req, res, next) {
  return (async () => {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized. Please login to continue.",
      });
    }

    req.user = user;
    return next();
  })();
}

function buildShortUrl(req, shortId) {
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/${shortId}`;
}

function serializeUrl(urlDoc, req) {
  return {
    id: urlDoc._id,
    shortId: urlDoc.shortId,
    redirectURL: urlDoc.redirectURL,
    shortURL: buildShortUrl(req, urlDoc.shortId),
    createdAt: urlDoc.createdAt,
    clicks: Array.isArray(urlDoc.visitHistory) ? urlDoc.visitHistory.length : 0,
  };
}

// GET /api/urls
router.get("/", async (req, res) => {
  try {
    const urls = await UrlModel.find({}).sort({ createdAt: -1 }).lean();

    return res.json({
      data: urls.map((urlDoc) => serializeUrl(urlDoc, req)),
    });
  } catch (error) {
    console.error("List URLs error:", error);
    return res.status(500).json({
      error: "Unable to fetch URLs",
    });
  }
});

router.get("/dashboard", requireUser, async (req, res) => {
  try {
    const urls = await UrlModel.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).lean();

    return res.json({
      data: urls.map((urlDoc) => serializeUrl(urlDoc, req)),
    });
  } catch (error) {
    console.error("Dashboard URLs error:", error);
    return res.status(500).json({
      error: "Unable to fetch dashboard data",
    });
  }
});

// POST /api/urls
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const redirectURL = String(body.url || "").trim();
    const customAlias = normalizeAlias(body.customAlias || body.alias || "");
    const user = await getAuthenticatedUser(req);

    if (!redirectURL) {
      return res.status(400).json({
        error: "url is required",
      });
    }

    if (!isValidUrl(redirectURL)) {
      return res.status(400).json({
        error: "Please provide a valid http/https URL",
      });
    }

    const aliasError = validateAlias(customAlias);
    if (aliasError) {
      return res.status(400).json({
        error: aliasError,
      });
    }

    const shortId = customAlias || nanoid(8);

    const existingUrl = await UrlModel.findOne({ shortId });
    if (existingUrl) {
      return res.status(409).json({
        error: "This alias is already in use. Please choose another one.",
      });
    }

    const createdUrl = await UrlModel.create({
      shortId,
      redirectURL,
      createdBy: user ? user._id : null,
    });

    return res.status(201).json({
      message: "Short URL created successfully",
      data: {
        id: createdUrl._id,
        shortId: createdUrl.shortId,
        redirectURL: createdUrl.redirectURL,
        shortURL: buildShortUrl(req, createdUrl.shortId),
        createdAt: createdUrl.createdAt,
        clicks: 0,
      },
    });
  } catch (error) {
    console.error("Create URL error:", error);
    return res.status(500).json({
      error: "Unable to create short URL",
    });
  }
});

router.put("/:shortId", requireUser, async (req, res) => {
  try {
    const body = req.body || {};
    const urlDoc = await UrlModel.findOne({ shortId: req.params.shortId });

    if (!urlDoc) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    if (urlDoc.createdBy && req.user._id.toString() !== urlDoc.createdBy.toString()) {
      return res.status(403).json({
        error: "You can only edit your own short URLs.",
      });
    }

    const nextRedirect = String(body.redirectURL || urlDoc.redirectURL || "").trim();
    if (!nextRedirect || !isValidUrl(nextRedirect)) {
      return res.status(400).json({
        error: "Please provide a valid http/https URL",
      });
    }

    const nextAlias = normalizeAlias(body.customAlias || body.alias || urlDoc.shortId);
    const aliasError = validateAlias(nextAlias);
    if (aliasError) {
      return res.status(400).json({
        error: aliasError,
      });
    }

    if (nextAlias !== urlDoc.shortId) {
      const existingUrl = await UrlModel.findOne({
        shortId: nextAlias,
        _id: { $ne: urlDoc._id },
      });

      if (existingUrl) {
        return res.status(409).json({
          error: "This alias is already in use. Please choose another one.",
        });
      }

      urlDoc.shortId = nextAlias;
    }

    urlDoc.redirectURL = nextRedirect;
    urlDoc.createdBy = req.user._id;
    await urlDoc.save();

    return res.json({
      message: "URL updated successfully",
      data: serializeUrl(urlDoc, req),
    });
  } catch (error) {
    console.error("Update URL error:", error);
    return res.status(500).json({
      error: "Unable to update URL",
    });
  }
});

router.delete("/:shortId", requireUser, async (req, res) => {
  try {
    const urlDoc = await UrlModel.findOne({ shortId: req.params.shortId });

    if (!urlDoc) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    if (urlDoc.createdBy && req.user._id.toString() !== urlDoc.createdBy.toString()) {
      return res.status(403).json({
        error: "You can only delete your own short URLs.",
      });
    }

    await UrlModel.deleteOne({ _id: urlDoc._id });

    return res.json({
      message: "URL deleted successfully",
      data: { shortId: req.params.shortId },
    });
  } catch (error) {
    console.error("Delete URL error:", error);
    return res.status(500).json({
      error: "Unable to delete URL",
    });
  }
});

// GET /api/urls/:shortId
router.get("/:shortId", async (req, res) => {
  try {
    const urlDoc = await UrlModel.findOne({ shortId: req.params.shortId }).lean();

    if (!urlDoc) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    return res.json({
      data: serializeUrl(urlDoc, req),
    });
  } catch (error) {
    console.error("Get URL error:", error);
    return res.status(500).json({
      error: "Unable to fetch URL",
    });
  }
});

// GET /api/urls/:shortId/stats
router.get("/:shortId/stats", async (req, res) => {
  try {
    const urlDoc = await UrlModel.findOne({ shortId: req.params.shortId }).lean();

    if (!urlDoc) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    const visits = (urlDoc.visitHistory || [])
      .slice()
      .reverse()
      .map((visit) => ({
        timestamp: visit.timestamp,
        referrer: visit.referrer || "Direct",
        userAgent: visit.userAgent || "Unknown",
      }));

    return res.json({
      data: {
        shortId: urlDoc.shortId,
        redirectURL: urlDoc.redirectURL,
        createdAt: urlDoc.createdAt,
        updatedAt: urlDoc.updatedAt,
        clicks: (urlDoc.visitHistory || []).length,
        visits,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({
      error: "Unable to fetch statistics",
    });
  }
});

module.exports = router;
