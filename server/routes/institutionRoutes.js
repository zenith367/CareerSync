// institutionRoutes.js
const express = require("express");
const router = express.Router();
const { db } = require("../services/firebase"); // Firestore config
const { sendEmail } = require("../utils/emailService"); // SendGrid helper

// ========== 1️⃣ REGISTER / UPDATE INSTITUTION PROFILE ==========
router.post("/register", async (req, res) => {
  try {
    const { institutionId, name, email, address, phone, website } = req.body;

    if (!institutionId || !name || !email) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    await db.collection("institutions").doc(institutionId).set(
      {
        name,
        email,
        address,
        phone,
        website,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.status(200).json({ message: "Institution registered/updated successfully." });
  } catch (error) {
    console.error("Error registering institution:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ========== 2️⃣ FACULTY MANAGEMENT ==========

// Add Faculty
router.post("/addFaculty", async (req, res) => {
  try {
    const { institutionId, facultyName, description } = req.body;

    if (!institutionId || !facultyName) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const newFaculty = {
      institutionId,
      facultyName,
      description,
      createdAt: new Date().toISOString(),
    };

    await db.collection("institutions").doc(institutionId).collection("faculties").add(newFaculty);
    res.status(200).json({ message: "Faculty added successfully." });
  } catch (error) {
    console.error("Error adding faculty:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update Faculty
router.put("/updateFaculty/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { facultyName, description } = req.body;

    await db.collection("faculties").doc(facultyId).update({
      facultyName,
      description,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ message: "Faculty updated successfully." });
  } catch (error) {
    console.error("Error updating faculty:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Delete Faculty
router.delete("/deleteFaculty/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;
    await db.collection("faculties").doc(facultyId).delete();
    res.status(200).json({ message: "Faculty deleted successfully." });
  } catch (error) {
    console.error("Error deleting faculty:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ========== 3️⃣ COURSE MANAGEMENT ==========

// Add Course
router.post("/addCourse", async (req, res) => {
  try {
    const { institutionId, facultyId, courseName, duration, description, requiredSubjects, minMarks, requiredCertificates } = req.body;

    if (!institutionId || !courseName) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const newCourse = {
      institutionId,
      facultyId,
      name: courseName,
      duration,
      description,
      requiredSubjects: requiredSubjects || [],
      minMarks: minMarks || 0,
      requiredCertificates: requiredCertificates || [],
      createdAt: new Date().toISOString(),
    };

    await db.collection("institutions").doc(institutionId).collection("courses").add(newCourse);
    res.status(200).json({ message: "Course added successfully." });
  } catch (error) {
    console.error("Error adding course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update Course
router.put("/updateCourse/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const { courseName, duration, description, requiredSubjects, minMarks, requiredCertificates } = req.body;

    await db.collection("courses").doc(courseId).update({
      name: courseName,
      duration,
      description,
      requiredSubjects,
      minMarks,
      requiredCertificates,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ message: "Course updated successfully." });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Delete Course
router.delete("/deleteCourse/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    await db.collection("courses").doc(courseId).delete();
    res.status(200).json({ message: "Course deleted successfully." });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ========== 4️⃣ VIEW STUDENT APPLICATIONS ==========
router.get("/applications/:institutionId", async (req, res) => {
  try {
    const { institutionId } = req.params;
    // Use collectionGroup to query all registrations for courses under this institution
    const snapshot = await db
      .collectionGroup("registrations")
      .where("institutionId", "==", institutionId)
      .where("type", "==", "course")
      .get();

    const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ========== 5️⃣ APPROVE / REJECT STUDENT APPLICATION ==========
router.post("/approveStudent", async (req, res) => {
  try {
    const { applicationId, status, studentEmail, studentName, courseName } = req.body;

    if (!applicationId || !status) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find the registration in subcollections
    const snapshot = await db.collectionGroup("registrations").where("__name__", "==", applicationId).get();
    if (snapshot.empty) {
      return res.status(404).json({ message: "Application not found." });
    }

    const docRef = snapshot.docs[0].ref;
    await docRef.update({
      status: status.toLowerCase(),
      reviewedAt: new Date().toISOString(),
    });

    // Send email if approved
    if (status === "Approved") {
      await sendEmail(
        studentEmail,
        "🎓 Application Approved",
        `Congratulations ${studentName}! Your application for ${courseName} has been approved.`
      );
    }

    res.status(200).json({ message: `Student application ${status} successfully.` });
  } catch (error) {
    console.error("Error approving/rejecting student:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ========== 6️⃣ PUBLISH ADMISSIONS ==========
router.post("/publishAdmission", async (req, res) => {
  try {
    const { studentId, institutionId, courseName, admissionStatus } = req.body;

    if (!studentId || !institutionId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Ensure student isn't admitted to multiple institutions
    const existingAdmit = await db
      .collectionGroup("registrations")
      .where("studentId", "==", studentId)
      .where("type", "==", "course")
      .where("status", "==", "admitted")
      .get();

    if (!existingAdmit.empty) {
      return res.status(400).json({
        message: "Student is already admitted to another institution.",
      });
    }

    // Update the registration status to admitted
    const regSnapshot = await db.collectionGroup("registrations")
      .where("studentId", "==", studentId)
      .where("institutionId", "==", institutionId)
      .where("courseName", "==", courseName)
      .where("type", "==", "course")
      .get();

    if (!regSnapshot.empty) {
      const regRef = regSnapshot.docs[0].ref;
      await regRef.update({ status: "admitted" });
    }

    // Mark institution as published
    await db.collection("institutions").doc(institutionId).update({ published: true });

    res.status(200).json({ message: "Admission published successfully." });
  } catch (error) {
    console.error("Error publishing admission:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
