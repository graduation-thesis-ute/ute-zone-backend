import express from "express"
import {
    toggleFollowPage,
    getPageFollowers,
    getPageFollowersOfCurrentUser,
    getSuggestedPages,
} from "../controllers/pageFollowerController.js"
import auth from "../middlewares/authentication.js";

const router = express.Router();

router.post("/follow",auth(""), toggleFollowPage);
router.get("/listPageFollowers", auth("PAGE_FOLLOWER_L"), getPageFollowers);
router.get("/list/current-user", auth("PAGE_FOLLOWER_L"), getPageFollowersOfCurrentUser);
router.get("/suggested", auth("PAGE_FOLLOWER_L"), getSuggestedPages);
router.get("/page/:pageId/followers", auth("PAGE_FOLLOWER_L"), getPageFollowers);
export {router as pageFollowerRouter};