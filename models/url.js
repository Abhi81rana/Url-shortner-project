const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    redirectURL: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    visitHistory: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        referrer: {
          type: String,
          default: "",
        },
        userAgent: {
          type: String,
          default: "",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const URL = mongoose.model("URL", urlSchema);

module.exports = URL;
