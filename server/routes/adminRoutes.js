const express = require("express");
const router = express.Router();

// Correct Firebase Admin import
const { admin, db } = require("../services/firebase");

// Firestore utilities
const { FieldValue } = require("firebase-admin/firestore");

// Email service
const { sendEmail } = require("../utils/emailService");

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
 * Send password email via SendGrid
 */
async function sendPasswordEmail(email, password) {
  const subject = "Welcome to Career Guidance Platform - Your Account Details";
  const text = `Hello,\n\nYour account has been approved!\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password immediately.\n\nBest regards,\nCareer Guidance Platform Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Career Guidance Platform!</h2>
      <p>Your account has been approved successfully.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      <p style="color: #d32f2f;"><strong>Important:</strong> Please log in and change your password immediately for security.</p>
      <p>Best regards,<br>Career Guidance Platform Team</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
}

module.exports = router;
