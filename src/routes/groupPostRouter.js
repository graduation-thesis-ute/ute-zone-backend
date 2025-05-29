import express from "express";
import auth from "../middlewares/authentication.js";
import {
    createGroupPost,
    getGroupPosts,
    updateGroupPost,
    deleteGroupPost,
    changePostStatus,
    getPost
} from "../controllers/groupPostController.js";

const router = express.Router();

// Create a new post in a group
router.post("/create", auth("GROUP_POST"), createGroupPost);

// Get posts in a group
router.get("/list", auth("GROUP_POST"), getGroupPosts);

// Update a post
router.put("/update/:postId", auth("GROUP_POST"), updateGroupPost);

// Delete a post
router.delete("/delete/:id", auth("GROUP_POST"), deleteGroupPost);

// Change post status (approve/reject)
router.put("/change-status", auth("GROUP_POST"), changePostStatus);

// Get a post
router.get("/get/:id", auth("GROUP_POST"), getPost);

export { router as groupPostRouter }; 