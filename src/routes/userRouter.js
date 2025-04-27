import express from "express";
import passport from "passport";
import {
  loginUser,
  getUserProfile,
  resetUserPassword,
  forgotUserPassword,
  registerUser,
  verifyUser,
  updateUserProfile,
  verifyToken,
  deleteUser,
  getUser,
  createUser,
  updateUser,
  loginAdmin,
  getUsers,
  requestChangeUserKeyInformation,
  verifyChangeUserKeyInformation,
  googleLoginUser,
} from "../controllers/userController.js";
import auth from "../middlewares/authentication.js";
import { moderateContent } from "../utils/contentModerator.js";

const router = express.Router();

router.post("/chatbot", async (req, res) => {
  const { content } = req.body;

  const moderation = await moderateContent(content);

  if (!moderation.isApproved) {
    return res.status(400).json({
      message: "Nội dung không được chấp nhận",
      detail: moderation.reason,
    });
  }

  // Nếu được duyệt => tiếp tục lưu post (giả lập)
  return res.json({ message: "Bài viết đã được duyệt", content });
});

router.post("/login", loginUser);
// Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  googleLoginUser
);
router.post("/verify-token", verifyToken);
router.get("/profile", auth(""), getUserProfile);
router.post("/register", registerUser);
router.post("/verify", verifyUser);
router.post("/reset-password", resetUserPassword);
router.post("/forgot-password", forgotUserPassword);
router.put("/update-profile", auth(""), updateUserProfile);
router.delete("/delete/:id", auth("USER_D"), deleteUser);
router.get("/list", auth("USER_L"), getUsers);
router.get("/get/:id", auth("USER_V"), getUser);
router.post("/create", auth("USER_C"), createUser);
router.put("/update", auth("USER_U"), updateUser);
router.post("/login-admin", loginAdmin);
router.post("/request-key-change", auth(""), requestChangeUserKeyInformation);
router.post("/verify-key-change", auth(""), verifyChangeUserKeyInformation);

export { router as userRouter };
