import express from "express";
import auth from "../middlewares/authentication.js";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  changeStatusGroup,
  getGroup,
  getGroups,
} from "../controllers/groupController.js";

const router = express.Router();    

router.post("/create", auth("GROUP_C"), createGroup);
router.put("/update", auth("GROUP_U"), updateGroup);
router.delete("/delete", auth("GROUP_D"), deleteGroup);
router.put("/change-status", auth("GROUP_C_S"), changeStatusGroup);
router.get("/get/:id", auth("GROUP_V"), getGroup);
router.get("/list", auth("GROUP_L"), getGroups);

export { router as groupRouter };