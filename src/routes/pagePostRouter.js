import express from "express";
import auth from "../middlewares/authentication.js";
import {
    createPost,
    updatePost,
    getPost,
    getPosts,
    deletePost,
    changeStatusPost,
} from "../controllers/pagePostController.js";

const router = express.Router();

router.post("/create", auth("PAGE_POST_C"), createPost);
router.put("/update", auth("PAGE_POST_U"), updatePost);
router.get("/get/:id", auth("PAGE_POST_V"), getPost);
router.get("/list", auth("PAGE_POST_L"), getPosts);
router.delete("/delete/:id", auth("PAGE_POST_D"), deletePost);
router.put("/change-state", auth("PAGE_POST_C_S"), changeStatusPost);

export {router as pagePostRouter};