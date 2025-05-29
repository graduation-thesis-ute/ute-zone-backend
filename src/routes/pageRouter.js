import express from "express";
import auth from "../middlewares/authentication.js";
import{
    createPage,
    updatePage,
    getPage,
    getPages,
} from "../controllers/pageController.js";

const router = express.Router();

router.post("/create", auth("PAGE_C"), createPage);
router.put("/update", auth("PAGE_U"), updatePage);
router.get("/get/:id", auth("PAGE_V"), getPage);
router.get("/list", auth("PAGE_L"), getPages);

export {router as pageRouter};