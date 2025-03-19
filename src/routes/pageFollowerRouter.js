import express from "express"
import {
    toggleFollowPage,
    getPageFollowers,
} from "../controllers/pageFollowerController.js"
import auth from "../middlewares/authentication.js";

const router = express.Router();

router.post("/follow",auth(""), toggleFollowPage);
router.get("/list/:id", auth("PAGE_FOLLOWER_L"), getPageFollowers);

export {router as pageFollowerRouter};