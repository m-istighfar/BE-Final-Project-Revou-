// SCHEMA.PISMMA

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model BloodType {
  BloodTypeID       Int                @id @default(autoincrement())
  Type              String             @unique
  Appointments      Appointment[]
  EmergencyRequests EmergencyRequest[]
  BloodInventories  BloodInventory[]
  HelpOffer         HelpOffer[]
}

model UserAuth {
  UserAuthID            Int       @id @default(autoincrement())
  Username              String    @unique
  Email                 String    @unique
  Password              String
  Role                  UserRole
  ResetPasswordToken    String?   @unique
  ResetPasswordExpires  DateTime?
  Verified              Boolean   @default(false)
  VerificationToken     String?   @unique
  User                  User?     @relation(fields: [UserID], references: [UserID])
  UserID                Int?      @unique
  CreatedAt             DateTime  @default(now())
  UpdatedAt             DateTime  @updatedAt
}

model User {
  UserID          Int            @id @default(autoincrement())
  ProvinceID      Int
  Province        Province       @relation(fields: [ProvinceID], references: [ProvinceID])
  Name            String
  Phone           String
  AdditionalInfo  String?
  Appointments    Appointment[]
  EmergencyRequests EmergencyRequest[]
  HelpOffers      HelpOffer[]
  BloodDrives     BloodDrive[]
  UserAuth        UserAuth?
  CreatedAt       DateTime       @default(now())
  UpdatedAt       DateTime       @updatedAt
}

model Province {
  ProvinceID      Int          @id @default(autoincrement())
  Name            String
  Capital         String
  Users           User[]
  BloodDrives     BloodDrive[]
  BloodInventories BloodInventory[]
  CreatedAt       DateTime     @default(now())
  UpdatedAt       DateTime     @updatedAt
}

model Appointment {
  AppointmentID   Int           @id @default(autoincrement())
  UserID          Int
  User            User          @relation(fields: [UserID], references: [UserID])
  BloodTypeID     Int
  BloodType       BloodType     @relation(fields: [BloodTypeID], references: [BloodTypeID])
  ScheduledDate   DateTime
  Location        String? 
  Status          AppointmentStatus @default(scheduled)
  CreatedAt       DateTime      @default(now())
  UpdatedAt       DateTime      @updatedAt
}

model EmergencyRequest {
  RequestID       Int           @id @default(autoincrement())
  UserID          Int
  User            User          @relation(fields: [UserID], references: [UserID])
  BloodTypeID     Int
  BloodType       BloodType     @relation(fields: [BloodTypeID], references: [BloodTypeID])
  RequestDate     DateTime
  Location        String
  AdditionalInfo  String?
  CreatedAt       DateTime      @default(now())
  UpdatedAt       DateTime      @updatedAt
}

model HelpOffer {
  OfferID            Int        @id @default(autoincrement())
  UserID             Int
  User               User       @relation(fields: [UserID], references: [UserID])
  BloodTypeID        Int        
  BloodType          BloodType  @relation(fields: [BloodTypeID], references: [BloodTypeID])
  IsWillingToDonate  Boolean    @default(false)
  CanHelpInEmergency Boolean    @default(false)
  Location           String
  Reason             String?    
  CreatedAt          DateTime   @default(now())
  UpdatedAt          DateTime   @updatedAt
}



model BloodDrive {
  DriveID         Int           @id @default(autoincrement())
  UserID          Int
  User            User          @relation(fields: [UserID], references: [UserID])
  Institute       String
  ProvinceID      Int
  Province        Province      @relation(fields: [ProvinceID], references: [ProvinceID])
  Designation     String
  ScheduledDate   DateTime
  CreatedAt       DateTime      @default(now())
  UpdatedAt       DateTime      @updatedAt
}

model BloodInventory {
  InventoryID     Int           @id @default(autoincrement())
  BloodTypeID     Int
  BloodType       BloodType     @relation(fields: [BloodTypeID], references: [BloodTypeID])
  Quantity        Int
  ExpiryDate      DateTime
  ProvinceID      Int
  Province        Province      @relation(fields: [ProvinceID], references: [ProvinceID])
  CreatedAt       DateTime      @default(now())
  UpdatedAt       DateTime      @updatedAt
}

enum UserRole {
  admin
  user
}

enum AppointmentStatus {
  scheduled
  completed
  cancelled
  rescheduled
}

// APP.JS

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const express = require("express");

const cookieParser = require("cookie-parser");

const authMiddleware = require("./middleware/authenticationMiddleware");
const authorizationMiddleware = require("./middleware/authorizationMiddleware");
const errorFormatter = require("./middleware/errorFormatter");
const applyMiddleware = require("./middleware/index");

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const helpOfferRoutes = require("./routes/helpOfferRoutes");
const bloodDriveRoutes = require("./routes/bloodDriveRoutes");

const app = express();
app.use(cookieParser());
applyMiddleware(app);

app.use("/auth", authRoutes);
app.use(
  "/appointments",
  authMiddleware,
  authorizationMiddleware(["user"]),
  appointmentRoutes
);

app.use(
  "/emergency",
  authMiddleware,
  authorizationMiddleware(["user"]),
  emergencyRoutes
);

app.use(
  "/help-offer",
  authMiddleware,
  authorizationMiddleware(["user"]),
  helpOfferRoutes
);

app.use("/blood-drive", authMiddleware, bloodDriveRoutes);

app.use(errorFormatter);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Listening on port ${PORT}...`));

// authenticationMiddleware.js

const jwt = require("jsonwebtoken");
const { JWT_SIGN } = require("../config/jwt.js");

const authenticationMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = jwt.verify(token, JWT_SIGN);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = authenticationMiddleware;

// authorizationMiddleware.js

const jwt = require("jsonwebtoken");
const { JWT_SIGN } = require("../config/jwt.js");

const authorizationMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decodedToken = jwt.verify(token, JWT_SIGN);

      if (allowedRoles.includes(decodedToken.role)) {
        next();
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
};

module.exports = authorizationMiddleware;


// authRoutes.js

const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");
const PasswordResetController = require("../controllers/PasswordResetController");

const { rateLimit } = require("express-rate-limit");

const UserRateLimitStore = require("../utils/UserRateLimitStore");

const windowMs = 15 * 60 * 1000;

const userRateLimitStoreInstance = new UserRateLimitStore(windowMs);

const userLoginLimiter = rateLimit({
  store: userRateLimitStoreInstance,
  windowMs: windowMs,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed login attempts, please try again after 15 minutes.",
  },
  keyGenerator: (req) => {
    const key = req.body.username;
    console.log(`Generating key for rate limiter: ${key}`);
    return key;
  },
});

router.post("/login", userLoginLimiter, AuthController.login);

router.post("/register", AuthController.register);
router.get("/verify-email/:token", AuthController.verifyEmail);

router.post(
  "/request-password-reset",
  PasswordResetController.requestPasswordReset
);

router.post(
  "/reset-password/:resetToken",
  PasswordResetController.resetPassword
);

module.exports = router;


// AuthController.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendVerificationEmail } = require("../services/mailService");

const {
  JWT_SIGN,
  JWT_REFRESH_SIGN,
  ACCESS_TOKEN_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION,
} = require("../config/jwt");

const successResponse = (res, message, data = null) => {
  const response = { message };
  if (data !== null) {
    response.data = data;
  }
  return res.status(200).json(response);
};

const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({ error: message });
};

const register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      name,
      phone,
      role,
      provinceId,
      additionalInfo,
    } = req.body;

    const existingUserAuthByUsername = await prisma.userAuth.findUnique({
      where: { Username: username },
    });
    if (existingUserAuthByUsername) {
      return errorResponse(res, "Username already exists");
    }

    const existingUserAuthByEmail = await prisma.userAuth.findUnique({
      where: { Email: email },
    });
    if (existingUserAuthByEmail) {
      return errorResponse(res, "Email already exists");
    }

    const provinceExists = await prisma.province.findUnique({
      where: { ProvinceID: parseInt(provinceId) },
    });
    if (!provinceExists) {
      return errorResponse(res, "Invalid ProvinceID");
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserAuth = await prisma.userAuth.create({
      data: {
        Username: username,
        Email: email,
        Password: hashedPassword,
        VerificationToken: verificationToken,
        Role: role || "user",
      },
    });

    const newUser = await prisma.user.create({
      data: {
        ProvinceID: parseInt(provinceId),
        Name: name,
        Phone: phone,
        AdditionalInfo: additionalInfo,
        UserAuth: {
          connect: { UserAuthID: newUserAuth.UserAuthID },
        },
      },
    });

    await sendVerificationEmail(email, verificationToken);

    return successResponse(res, "User successfully registered", {
      userId: newUser.UserID,
      username,
      email,
    });
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const userAuth = await prisma.userAuth.findUnique({
      where: { VerificationToken: token },
    });
    if (!userAuth) {
      return errorResponse(res, "Invalid verification token.");
    }

    await prisma.userAuth.update({
      where: { UserAuthID: userAuth.UserAuthID },
      data: { Verified: true, VerificationToken: null },
    });

    return successResponse(res, "Email verified successfully!");
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const userAuth = await prisma.userAuth.findUnique({
      where: { Username: username },
    });
    if (!userAuth) {
      return errorResponse(res, "User does not exist");
    }

    if (!userAuth.Verified) {
      return errorResponse(
        res,
        "Email not verified. Please verify your email first."
      );
    }

    const isPasswordCorrect = await bcrypt.compare(password, userAuth.Password);
    if (!isPasswordCorrect) {
      return errorResponse(res, "Password is incorrect");
    }

    const accessToken = jwt.sign(
      {
        username: userAuth.Username,
        id: userAuth.UserAuthID,
        role: userAuth.Role,
      },
      JWT_SIGN,
      { expiresIn: ACCESS_TOKEN_EXPIRATION }
    );

    const refreshToken = jwt.sign(
      {
        username: userAuth.Username,
        id: userAuth.UserAuthID,
        role: userAuth.Role,
      },
      JWT_REFRESH_SIGN,
      { expiresIn: REFRESH_TOKEN_EXPIRATION }
    );

    return successResponse(res, "Login successful", {
      userId: userAuth.UserAuthID,
      accessToken,
      refreshToken,
      accessTokenExp: ACCESS_TOKEN_EXPIRATION,
      refreshTokenExp: REFRESH_TOKEN_EXPIRATION,
      role: userAuth.Role,
    });
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
};

// appointmentRoutes.js

const express = require("express");
const router = express.Router();
const AppointmentController = require("../controllers/AppointmentController");
const authorizationMiddleware = require("../middleware/authorizationMiddleware");

router.get("/", AppointmentController.getAppointments);
router.get("/:appointmentId", AppointmentController.getAppointmentById);
router.post("/create", AppointmentController.createAppointment);
router.post("/reschedule", AppointmentController.rescheduleAppointment);
router.post("/cancel", AppointmentController.cancelAppointment);

router.post(
  "/complete",
  authorizationMiddleware(["admin"]),
  AppointmentController.completeAppointment
);

module.exports = router;

// AppointmentController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const {
      status,
      startDate,
      endDate,
      userId: queryUserId,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * pageSize;
    const sortingCriteria = sortBy || "ScheduledDate";
    const sortingOrder = sortOrder === "desc" ? "desc" : "asc";

    const validStatuses = [
      "scheduled",
      "completed",
      "cancelled",
      "rescheduled",
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid appointment status" });
    }

    let queryOptions = {
      skip: offset,
      take: pageSize,
      orderBy: {
        [sortingCriteria]: sortingOrder,
      },
      include: {
        BloodType: true,
      },
    };

    if (userRole === "admin" && queryUserId) {
      queryOptions.where = { UserID: parseInt(queryUserId) };
    } else {
      queryOptions.where = { UserID: userId };
    }

    if (status) {
      queryOptions.where.Status = status;
    }

    if (startDate && endDate) {
      queryOptions.where.ScheduledDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const appointments = await prisma.appointment.findMany(queryOptions);
    const totalRecords = await prisma.appointment.count({
      where: queryOptions.where,
    });

    res.status(200).json({
      totalRecords,
      totalPages: Math.ceil(totalRecords / pageSize),
      currentPage: pageNumber,
      appointments,
    });
  } catch (error) {
    res.status(500).json({
      error: "An error occurred while fetching appointments: " + error.message,
    });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { AppointmentID: parseInt(appointmentId) },
      include: {
        BloodType: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (userRole !== "admin" && appointment.UserID !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.status(200).json(appointment);
  } catch (error) {
    res.status(500).json({
      error:
        "An error occurred while fetching the appointment: " + error.message,
    });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bloodType, scheduledDate } = req.body;

    if (!scheduledDate || isNaN(new Date(scheduledDate).getTime())) {
      return res.status(400).json({ error: "Invalid scheduled date" });
    }

    const appointmentDate = new Date(scheduledDate);
    if (appointmentDate < new Date()) {
      return res
        .status(400)
        .json({ error: "Scheduled date cannot be in the past" });
    }

    const userWithProvince = await prisma.user.findUnique({
      where: { UserID: userId },
      include: { Province: true },
    });

    if (!userWithProvince?.Province) {
      return res
        .status(400)
        .json({ error: "User's province information is missing" });
    }

    const bloodTypeRecord = await prisma.bloodType.findFirst({
      where: { Type: bloodType },
    });
    if (!bloodTypeRecord) {
      return res.status(400).json({ error: "Invalid blood type" });
    }

    const startOfDay = new Date(appointmentDate).setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate).setHours(23, 59, 59, 999);

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        UserID: userId,
        ScheduledDate: { gte: new Date(startOfDay), lte: new Date(endOfDay) },
      },
    });
    if (existingAppointment) {
      return res
        .status(400)
        .json({ error: "An appointment already exists on this date" });
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        UserID: userId,
        BloodTypeID: bloodTypeRecord.BloodTypeID,
        ScheduledDate: appointmentDate,
        Location: userWithProvince.Province.Capital,
      },
    });

    res.status(201).json({
      message: "Appointment created successfully",
      appointmentDetails: newAppointment,
    });
  } catch (error) {
    res.status(500).json({
      error:
        "An error occurred while creating the appointment: " + error.message,
    });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId, newScheduledDate } = req.body;

    if (!newScheduledDate || isNaN(new Date(newScheduledDate).getTime())) {
      return res.status(400).json({ error: "Invalid new scheduled date" });
    }

    const newAppointmentDate = new Date(newScheduledDate);
    if (newAppointmentDate < new Date()) {
      return res
        .status(400)
        .json({ error: "New scheduled date cannot be in the past" });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { AppointmentID: appointmentId },
    });

    if (!appointment || appointment.UserID !== userId) {
      return res
        .status(404)
        .json({ error: "Appointment not found or user mismatch" });
    }

    if (
      appointment.Status === "completed" ||
      appointment.Status === "cancelled"
    ) {
      return res.status(400).json({
        error: "Cannot reschedule a completed or cancelled appointment",
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { AppointmentID: appointmentId },
      data: {
        ScheduledDate: newAppointmentDate,
        Status: "rescheduled",
      },
    });

    res.status(200).json({
      message: "Appointment rescheduled successfully",
      updatedAppointmentDetails: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      error:
        "An error occurred while rescheduling the appointment: " +
        error.message,
    });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { AppointmentID: appointmentId },
    });

    if (!appointment || appointment.UserID !== userId) {
      return res
        .status(404)
        .json({ error: "Appointment not found or user mismatch" });
    }

    if (
      appointment.Status === "completed" ||
      appointment.Status === "cancelled"
    ) {
      return res.status(400).json({
        error: "Cannot cancel a completed or already cancelled appointment",
      });
    }

    if (new Date(appointment.ScheduledDate) < new Date()) {
      return res
        .status(400)
        .json({ error: "Cannot cancel a past appointment" });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { AppointmentID: appointmentId },
      data: {
        Status: "cancelled",
      },
    });

    res.status(200).json({
      message: "Appointment cancelled successfully",
      updatedAppointmentDetails: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      error:
        "An error occurred while cancelling the appointment: " + error.message,
    });
  }
};

exports.completeAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { AppointmentID: appointmentId },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (new Date(appointment.ScheduledDate) > new Date()) {
      return res.status(400).json({
        error: "Cannot complete an appointment that is in the future",
      });
    }

    if (
      appointment.Status === "completed" ||
      appointment.Status === "cancelled"
    ) {
      return res.status(400).json({
        error: "Cannot complete a cancelled or already completed appointment",
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { AppointmentID: appointmentId },
      data: {
        Status: "completed",
      },
    });

    res.status(200).json({
      message: "Appointment marked as completed successfully",
      updatedAppointmentDetails: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      error:
        "An error occurred while updating the appointment status: " +
        error.message,
    });
  }
};

// emergencyRoutes.js

const express = require("express");
const router = express.Router();
const EmergencyController = require("../controllers/EmergencyController");

router.post("/request", EmergencyController.createEmergencyRequest);

router.get("/", EmergencyController.getAllEmergencyRequests);

router.get("/:emergencyRequestId", EmergencyController.getEmergencyRequestById);

router.put("/:emergencyRequestId", EmergencyController.updateEmergencyRequest);

router.delete(
  "/:emergencyRequestId",
  EmergencyController.deleteEmergencyRequest
);

module.exports = router;

// EmergencyController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAllEmergencyRequests = async (req, res) => {
  try {
    const {
      page,
      limit,
      bloodType,
      startDate,
      endDate,
      provinceId,
      sortBy,
      sortOrder,
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * pageSize;
    const sortingCriteria = sortBy || "RequestDate";
    const sortingOrder = sortOrder === "desc" ? "desc" : "asc";

    let whereClause = {};
    if (bloodType) {
      whereClause.BloodTypeID = parseInt(bloodType);
    }

    if (startDate && endDate) {
      whereClause.RequestDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    if (provinceId) {
      whereClause.User = {
        ProvinceID: parseInt(provinceId),
      };
    }

    const emergencyRequests = await prisma.emergencyRequest.findMany({
      skip: offset,
      take: pageSize,
      orderBy: {
        [sortingCriteria]: sortingOrder,
      },
      where: whereClause,
      include: {
        BloodType: true,
        User: { select: { Name: true, Province: true } },
      },
    });

    const totalRequests = await prisma.emergencyRequest.count({
      where: whereClause,
    });

    res.status(200).json({
      totalRequests,
      totalPages: Math.ceil(totalRequests / pageSize),
      currentPage: pageNumber,
      emergencyRequests,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching emergency requests: " + error.message });
  }
};

exports.getEmergencyRequestById = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;

    const emergencyRequest = await prisma.emergencyRequest.findUnique({
      where: { RequestID: parseInt(emergencyRequestId) },
      include: {
        BloodType: true,
        User: true,
      },
    });

    if (!emergencyRequest) {
      return res.status(404).json({ error: "Emergency request not found" });
    }

    res.status(200).json(emergencyRequest);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching emergency request: " + error.message });
  }
};

exports.createEmergencyRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bloodType, additionalInfo } = req.body;

    const bloodTypeRecord = await prisma.bloodType.findFirst({
      where: { Type: bloodType },
    });
    if (!bloodTypeRecord) {
      return res.status(400).json({ error: "Invalid blood type" });
    }

    const userWithProvince = await prisma.user.findUnique({
      where: { UserID: userId },
      include: { Province: true },
    });

    if (!userWithProvince?.Province) {
      return res
        .status(400)
        .json({ error: "User's province information is missing" });
    }

    const inventory = await prisma.bloodInventory.findFirst({
      where: {
        BloodTypeID: bloodTypeRecord.BloodTypeID,
        Quantity: { gt: 0 },
        ProvinceID: userWithProvince.Province.ProvinceID,
      },
    });

    if (!inventory) {
      return res.status(404).json({
        error: "Requested blood type currently unavailable in your area",
      });
    }
    const newEmergencyRequest = await prisma.emergencyRequest.create({
      data: {
        UserID: userId,
        BloodTypeID: bloodTypeRecord.BloodTypeID,
        RequestDate: new Date(),
        AdditionalInfo: additionalInfo,
        Location: userWithProvince.Province.Capital,
      },
    });

    res.status(201).json({
      message: "Emergency blood request created successfully",
      emergencyRequest: newEmergencyRequest,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEmergencyRequest = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;
    const { additionalInfo, newBloodTypeID } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const emergencyRequest = await prisma.emergencyRequest.findUnique({
      where: { RequestID: parseInt(emergencyRequestId) },
    });

    if (!emergencyRequest) {
      return res.status(404).json({ error: "Emergency request not found" });
    }

    if (emergencyRequest.UserID !== userId && userRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this emergency request" });
    }

    const updatedEmergencyRequest = await prisma.emergencyRequest.update({
      where: { RequestID: parseInt(emergencyRequestId) },
      data: {
        AdditionalInfo: additionalInfo || emergencyRequest.AdditionalInfo,
        BloodTypeID: newBloodTypeID || emergencyRequest.BloodTypeID,
      },
    });

    res.status(200).json({
      message: "Emergency request updated successfully",
      emergencyRequest: updatedEmergencyRequest,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error updating emergency request: " + error.message });
  }
};

exports.deleteEmergencyRequest = async (req, res) => {
  try {
    const { emergencyRequestId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const emergencyRequest = await prisma.emergencyRequest.findUnique({
      where: { RequestID: parseInt(emergencyRequestId) },
    });

    if (!emergencyRequest) {
      return res.status(404).json({ error: "Emergency request not found" });
    }

    if (emergencyRequest.UserID !== userId && userRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this emergency request" });
    }

    await prisma.emergencyRequest.delete({
      where: { RequestID: parseInt(emergencyRequestId) },
    });

    res.status(200).json({ message: "Emergency request deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error deleting emergency request: " + error.message });
  }
};

// bloodDriveRoutes.js

const express = require("express");
const router = express.Router();
const BloodDriveController = require("../controllers/BloodDriveController");

router.post("/create", BloodDriveController.createBloodDrive);
router.get("/", BloodDriveController.getAllBloodDrives);
router.get("/:bloodDriveId", BloodDriveController.getBloodDriveById);
router.put("/:bloodDriveId", BloodDriveController.updateBloodDrive);
router.delete("/:bloodDriveId", BloodDriveController.deleteBloodDrive);

module.exports = router;

// bloodDriveController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAllBloodDrives = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const sortBy = req.query.sortBy || "ScheduledDate";
    const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";
    const filterProvince = req.query.filterProvince;
    const filterDesignation = req.query.filterDesignation;

    let whereClause = {};
    if (filterProvince) {
      whereClause.ProvinceID = parseInt(filterProvince);
    }
    if (filterDesignation) {
      whereClause.Designation = filterDesignation;
    }

    const bloodDrives = await prisma.bloodDrive.findMany({
      skip: offset,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      where: whereClause,
      include: {
        Province: true,
        User: true,
      },
    });

    const totalRecords = await prisma.bloodDrive.count({ where: whereClause });

    res.status(200).json({
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
      bloodDrives,
    });
  } catch (error) {
    res.status(500).json({
      error: "An error occurred while fetching blood drives: " + error.message,
    });
  }
};

exports.getBloodDriveById = async (req, res) => {
  try {
    const { bloodDriveId } = req.params;

    const bloodDrive = await prisma.bloodDrive.findUnique({
      where: { DriveID: parseInt(bloodDriveId) },
    });

    if (!bloodDrive) {
      return res.status(404).json({ error: "Blood drive not found" });
    }

    res.status(200).json(bloodDrive);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createBloodDrive = async (req, res) => {
  try {
    const userId = req.user.id;
    const { institute, provinceId, designation, scheduledDate } = req.body;

    if (!institute || !provinceId || !designation || !scheduledDate) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const parsedDate = new Date(scheduledDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid scheduled date" });
    }

    if (parsedDate <= new Date()) {
      return res
        .status(400)
        .json({ error: "Scheduled date must be in the future" });
    }

    const provinceIdInt = parseInt(provinceId, 10);

    const provinceExists = await prisma.province.findUnique({
      where: { ProvinceID: provinceIdInt },
    });

    if (!provinceExists) {
      return res.status(400).json({ error: "Invalid ProvinceID" });
    }

    const newBloodDrive = await prisma.bloodDrive.create({
      data: {
        UserID: userId,
        Institute: institute,
        ProvinceID: provinceIdInt,
        Designation: designation,
        ScheduledDate: parsedDate,
      },
    });

    res
      .status(201)
      .json({ message: "Blood drive created successfully", newBloodDrive });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBloodDrive = async (req, res) => {
  try {
    const { bloodDriveId } = req.params;
    const { institute, provinceId, designation, scheduledDate } = req.body;
    const bloodDriveIdInt = parseInt(bloodDriveId, 10);

    if (!institute && !provinceId && !designation && !scheduledDate) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for update" });
    }

    const existingBloodDrive = await prisma.bloodDrive.findUnique({
      where: { DriveID: bloodDriveIdInt },
    });

    if (!existingBloodDrive) {
      return res.status(404).json({ error: "Blood drive not found" });
    }

    const updateData = {};
    if (institute) updateData.Institute = institute;
    if (provinceId) updateData.ProvinceID = parseInt(provinceId, 10);
    if (designation) updateData.Designation = designation;
    if (scheduledDate) {
      const parsedDate = new Date(scheduledDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Invalid scheduled date" });
      }
      if (parsedDate <= new Date()) {
        return res
          .status(400)
          .json({ error: "Scheduled date must be in the future" });
      }
      updateData.ScheduledDate = parsedDate;
    }

    const updatedBloodDrive = await prisma.bloodDrive.update({
      where: { DriveID: bloodDriveIdInt },
      data: updateData,
    });

    res.status(200).json({
      message: "Blood drive updated successfully",
      updatedBloodDrive,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error updating blood drive: " + error.message });
  }
};

exports.deleteBloodDrive = async (req, res) => {
  try {
    const { bloodDriveId } = req.params;
    const bloodDriveIdInt = parseInt(bloodDriveId, 10);

    const existingBloodDrive = await prisma.bloodDrive.findUnique({
      where: { DriveID: bloodDriveIdInt },
    });

    if (!existingBloodDrive) {
      return res.status(404).json({ error: "Blood drive not found" });
    }

    await prisma.bloodDrive.delete({
      where: { DriveID: bloodDriveIdInt },
    });

    res.status(200).json({ message: "Blood drive deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error deleting blood drive: " + error.message });
  }
};

// bloodInventoryRoutes.js

const express = require("express");
const router = express.Router();
const bloodInventoryController = require("../controllers/BloodInventoryController");

router.post("/", bloodInventoryController.createBloodInventory);

router.get("/", bloodInventoryController.getBloodInventories);
router.get("/:inventoryID", bloodInventoryController.getBloodInventoryById);

router.put("/:inventoryID", bloodInventoryController.updateBloodInventory);

router.delete("/:inventoryID", bloodInventoryController.deleteBloodInventory);

module.exports = router;

// BloodInventoryController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const successResponse = (res, message, data) => {
  return res.status(200).json({ message, data });
};

const errorResponse = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({ error: message });
};

const validateInventoryData = ({ bloodTypeID, quantity, provinceID }) => {
  if (!bloodTypeID || !quantity || !provinceID) {
    return "Missing required fields";
  }
  if (quantity <= 0) {
    return "Quantity must be a positive number";
  }
  return null;
};

exports.createBloodInventory = async (req, res) => {
  try {
    const { bloodTypeID, quantity, expiryDate, provinceID } = req.body;

    const validationError = validateInventoryData(req.body);
    if (validationError) {
      return errorResponse(res, validationError, 400);
    }

    const province = await prisma.province.findUnique({
      where: { ProvinceID: provinceID },
    });
    if (!province) {
      return errorResponse(res, "Province not found", 404);
    }

    const today = new Date();
    const defaultExpiryDate = new Date(today);
    defaultExpiryDate.setDate(today.getDate() + 42);

    const newInventory = await prisma.bloodInventory.create({
      data: {
        BloodTypeID: bloodTypeID,
        Quantity: quantity,
        ExpiryDate: defaultExpiryDate,
        ProvinceID: provinceID,
      },
    });

    successResponse(res, "Blood inventory added successfully", newInventory);
  } catch (error) {
    errorResponse(res, "Error creating blood inventory: " + error.message);
  }
};

exports.getBloodInventories = async (req, res) => {
  try {
    const { page, limit, bloodTypeID, provinceID } = req.query;
    const pageNumber = Math.max(parseInt(page) || 1, 1);

    const pageSize = Math.max(parseInt(limit) || 10, 1);
    const offset = (pageNumber - 1) * pageSize;

    let whereClause = {};
    if (bloodTypeID) whereClause.BloodTypeID = parseInt(bloodTypeID);
    if (provinceID) whereClause.ProvinceID = parseInt(provinceID);

    const bloodInventories = await prisma.bloodInventory.findMany({
      skip: offset,
      take: pageSize,
      where: whereClause,
      include: { BloodType: true, Province: true },
    });

    const totalRecords = await prisma.bloodInventory.count({
      where: whereClause,
    });
    successResponse(res, "Blood inventories fetched successfully", {
      totalRecords,
      bloodInventories,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalRecords / pageSize),
    });
  } catch (error) {
    errorResponse(res, "Error fetching blood inventories: " + error.message);
  }
};

exports.getBloodInventoryById = async (req, res) => {
  const { inventoryID } = req.params;

  try {
    const inventory = await prisma.bloodInventory.findUnique({
      where: { InventoryID: parseInt(inventoryID) },
      include: { BloodType: true, Province: true },
    });

    if (!inventory) {
      return errorResponse(res, "Blood inventory not found", 404);
    }

    successResponse(res, "Blood inventory fetched successfully", inventory);
  } catch (error) {
    errorResponse(res, "Error fetching blood inventory: " + error.message);
  }
};

exports.updateBloodInventory = async (req, res) => {
  const { inventoryID } = req.params;
  const { quantity, expiryDate } = req.body;

  try {
    const existingInventory = await prisma.bloodInventory.findUnique({
      where: { InventoryID: parseInt(inventoryID) },
    });
    if (!existingInventory) {
      return errorResponse(res, "Blood inventory not found", 404);
    }

    const updatedInventory = await prisma.bloodInventory.update({
      where: { InventoryID: parseInt(inventoryID) },
      data: {
        Quantity: quantity,
        ExpiryDate: expiryDate ? new Date(expiryDate) : undefined,
      },
    });

    successResponse(
      res,
      "Blood inventory updated successfully",
      updatedInventory
    );
  } catch (error) {
    errorResponse(res, "Error updating blood inventory: " + error.message);
  }
};

exports.deleteBloodInventory = async (req, res) => {
  const { inventoryID } = req.params;
  try {
    const existingInventory = await prisma.bloodInventory.findUnique({
      where: { InventoryID: parseInt(inventoryID) },
    });
    if (!existingInventory) {
      return errorResponse(res, "Blood inventory not found", 404);
    }

    await prisma.bloodInventory.delete({
      where: { InventoryID: parseInt(inventoryID) },
    });
    successResponse(res, "Blood inventory deleted successfully");
  } catch (error) {
    errorResponse(res, "Error deleting blood inventory: " + error.message);
  }
};

// helpOfferRoutes.js

const express = require("express");
const router = express.Router();
const HelpOfferController = require("../controllers/HelpOfferController");

router.post("/offer", HelpOfferController.createHelpOffer);
router.get("/", HelpOfferController.getAllHelpOffers);
router.put("/:helpOfferId", HelpOfferController.updateHelpOffer);
router.delete("/:helpOfferId", HelpOfferController.deleteHelpOffer);

module.exports = router;

// HelpOfferController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAllHelpOffers = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      bloodType,
      willingToDonate,
      canHelpInEmergency,
    } = req.query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * pageSize;

    let whereClause = {};
    if (search) {
      whereClause.OR = [
        { User: { Name: { contains: search } } },
        { Reason: { contains: search } },
        { Location: { contains: search } },
      ];
    }
    if (bloodType) {
      whereClause.BloodTypeID = parseInt(bloodType);
    }
    if (typeof willingToDonate === "boolean") {
      whereClause.IsWillingToDonate = willingToDonate;
    }
    if (typeof canHelpInEmergency === "boolean") {
      whereClause.CanHelpInEmergency = canHelpInEmergency;
    }

    const helpOffers = await prisma.helpOffer.findMany({
      skip: offset,
      take: pageSize,
      where: whereClause,
      include: {
        User: true,
        BloodType: true,
      },
    });

    const totalHelpOffers = await prisma.helpOffer.count({
      where: whereClause,
    });

    res.status(200).json({
      total: totalHelpOffers,
      totalPages: Math.ceil(totalHelpOffers / pageSize),
      currentPage: pageNumber,
      helpOffers,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error while fetching help offers: " + error.message,
    });
  }
};

exports.createHelpOffer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isWillingToDonate, canHelpInEmergency, bloodType, reason } =
      req.body;

    if (
      typeof isWillingToDonate !== "boolean" ||
      typeof canHelpInEmergency !== "boolean"
    ) {
      return res.status(400).json({
        error:
          "isWillingToDonate and canHelpInEmergency must be boolean values",
      });
    }

    const bloodTypeRecord = await prisma.bloodType.findFirst({
      where: { Type: bloodType },
    });
    if (!bloodTypeRecord) {
      return res.status(400).json({ error: "Invalid blood type specified" });
    }

    const userWithProvince = await prisma.user.findUnique({
      where: { UserID: userId },
      include: { Province: true },
    });
    if (!userWithProvince || !userWithProvince.Province) {
      return res
        .status(404)
        .json({ error: "User or user's province information not found" });
    }

    const newHelpOffer = await prisma.helpOffer.create({
      data: {
        UserID: userId,
        BloodTypeID: bloodTypeRecord.BloodTypeID,
        IsWillingToDonate: isWillingToDonate,
        CanHelpInEmergency: canHelpInEmergency,
        Location: userWithProvince.Province.Capital,
        Reason: reason,
      },
    });

    res.status(201).json({
      message: "Help offer created successfully",
      helpOffer: newHelpOffer,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error while creating help offer: " + error.message,
    });
  }
};

exports.updateHelpOffer = async (req, res) => {
  try {
    const { helpOfferId } = req.params;
    const userId = req.user.id;
    const { isWillingToDonate, canHelpInEmergency, reason } = req.body;

    const existingHelpOffer = await prisma.helpOffer.findUnique({
      where: { OfferID: parseInt(helpOfferId) },
    });

    if (!existingHelpOffer) {
      return res.status(404).json({ error: "Help offer not found" });
    }

    // Authorization check: Only allow the creator or an admin to update
    if (existingHelpOffer.UserID !== userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this help offer" });
    }

    const updatedHelpOffer = await prisma.helpOffer.update({
      where: { OfferID: parseInt(helpOfferId) },
      data: {
        IsWillingToDonate:
          isWillingToDonate ?? existingHelpOffer.IsWillingToDonate,
        CanHelpInEmergency:
          canHelpInEmergency ?? existingHelpOffer.CanHelpInEmergency,
        Reason: reason ?? existingHelpOffer.Reason,
      },
    });

    res.status(200).json({
      message: "Help offer updated successfullys",
      helpOffer: updatedHelpOffer,
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error while updating help offer: " + error.message,
    });
  }
};

exports.deleteHelpOffer = async (req, res) => {
  try {
    const { helpOfferId } = req.params;
    const userId = req.user.id;

    const helpOffer = await prisma.helpOffer.findUnique({
      where: { OfferID: parseInt(helpOfferId) },
    });

    if (!helpOffer) {
      return res.status(404).json({ error: "Help offer not found" });
    }

    if (helpOffer.UserID !== userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this help offer" });
    }

    await prisma.helpOffer.delete({
      where: { OfferID: parseInt(helpOfferId) },
    });

    res.status(200).json({ message: "Help offer deleted successfully" });
  } catch (error) {
    res.status(500).json({
      error: "Server error while deleting help offer: " + error.message,
    });
  }
};



