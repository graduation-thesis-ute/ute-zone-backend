import express from "express";
import auth from "../middlewares/authentication.js";
import {
    sendJoinRequest,
    acceptJoinRequest,
    rejectJoinRequest,
    getJoinRequests,
    deleteJoinRequest
} from "../controllers/groupJoinRequestController.js";

const router = express.Router();

// Send join request to a group
router.post("/send", auth("GROUP_JOIN_REQUEST_C"), sendJoinRequest);

// Accept a join request
router.put("/accept", auth("GROUP_JOIN_REQUEST_U"), acceptJoinRequest);

// Reject a join request
router.put("/reject/:requestId", auth("GROUP_JOIN_REQUEST_U"), rejectJoinRequest);

// Get list of join requests
router.get("/list", auth("GROUP_JOIN_REQUEST_L"), getJoinRequests);

// Delete a join request
router.delete("/delete/:requestId", auth("GROUP_JOIN_REQUEST_D"), deleteJoinRequest);

export { router as groupJoinRequestRouter }; 