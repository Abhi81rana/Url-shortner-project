require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const URL = require("./models/url");
const User = require("./models/user");
const urlRouter = require("./routes/url");

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const JWT_SECRET = process.env.JWT_SECRET || "shortener-dev-secret";
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "my-url-shortner",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function seedDefaultAdmin() {
  try {
    const existingAdmin = await User.findOne({ username: DEFAULT_ADMIN_USERNAME });
    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    await User.create({
      username: DEFAULT_ADMIN_USERNAME,
      email: "admin@example.com",
      passwordHash,
      role: "admin",
    });

    console.log(`Default admin user created: ${DEFAULT_ADMIN_USERNAME}`);
  } catch (error) {
    console.error("Admin seeding failed:", error.message);
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: "Username must be between 3 and 30 characters." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });

    if (existingUser) {
      return res.status(409).json({ error: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: "user",
    });

    const token = createToken(user);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Unable to register user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const usernameOrEmail = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "username/email and password are required" });
    }

    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = createToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Unable to login" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

app.use("/api/urls", urlRouter);

// Redirect short URL and track visit.
app.get("/:shortId", async (req, res) => {
  try {
    const urlDoc = await URL.findOne({ shortId: req.params.shortId });

    if (!urlDoc) {
      return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    }

    urlDoc.visitHistory.push({
      timestamp: new Date(),
      referrer: req.get("referer") || "",
      userAgent: req.get("user-agent") || "",
    });

    await urlDoc.save();

    return res.redirect(urlDoc.redirectURL);
  } catch (error) {
    console.error("Redirect error:", error);
    return res.status(500).send("Unable to process this short URL.");
  }
});

app.use((req, res) => {
  if (req.accepts("html")) {
    return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  }

  return res.status(404).json({
    error: "Route not found",
  });
});

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is missing. Create a .env file from .env.example."
      );
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    await seedDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
