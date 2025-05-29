import express from "express";
import auth  from "../middlewares/authentication.js";
import {
    createPagePostReaction,
    deletePagePostReaction,
    getPagePostReactions,
} from "../controllers/pagePostReactionController.js";

const router = express.Router();

router.post("/create", auth("PAGE_POST_R_C"), createPagePostReaction);
router.delete("/delete/:id", auth("PAGE_POST_R_D"), deletePagePostReaction);
router.get("/list", auth("PAGE_POST_R_L"), getPagePostReactions);

export {router as pagePostReactionRouter};