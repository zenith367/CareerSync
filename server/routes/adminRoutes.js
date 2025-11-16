const express = require("express");
const router = express.Router();

// Correct Firebase Admin import
const { admin, db } = require("../services/firebase");

// Firestore utilities
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Approve a registration (institution or company)
 */
router.post("/approve-registration", async (req, res) => {
  try {
    const { registrationId, email, name, role } = req.body;

    if (!registrationId || !email || !name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Approval request:", req.body);

    let uid = null;

    // Step 1 → Check if email exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
      console.log("Existing user → UID:", uid);

    } catch (err) {
      if (err.code === "auth/user-not-found") {
        const generatedPassword = Math.random().toString(36).slice(-8);

        const newUser = await admin.auth().createUser({
          email,
          password: generatedPassword,
          emailVerified: false,
        });

        uid = newUser.uid;

        await sendPasswordEmail(email, generatedPassword);
        console.log("New user created + email sent.");

      } else {
        console.error("Firebase email lookup error:", err);
        return res.status(500).json({ error: "Email lookup failed" });
      }
    }

    if (!uid) {
      return res.status(500).json({ error: "UID was not generated" });
    }

    // Step 2 → Move registration → users + role collection
    const regRef = db.collection("registrations").doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const regData = regSnap.data();

    // Add user
    await db.collection("users").doc(uid).set({
      uid,
      email,
      name,
      role,
      createdAt: FieldValue.serverTimestamp(),
      ...regData
    });

    // Add to role-specific collection
    await db.collection(role).doc(uid).set({
      uid,
      email,
      name,
      createdAt: FieldValue.serverTimestamp(),
      ...regData
    });

    // Delete registration
    await regRef.delete();

    return res.status(200).json({ success: true, uid });

  } catch (error) {
    console.error("Approval error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Dummy email sender
 */
async function sendPasswordEmail(email, password) {
  console.log(`Email sent to ${email}: password = ${password}`);
  return true;
}

module.exports = router;
