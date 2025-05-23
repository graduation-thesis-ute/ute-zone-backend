import Page from "../models/pageModel.js";
import Notification from "../models/notificationModel.js";
import PageMember from "../models/pageMemberModel.js";
import PageFollower from "../models/pageFollowerModel.js";
import { createDefaultPageModerationSetting } from "./moderationSettingController.js";
import {
    deleteFileByUrl,
    isValidUrl,
    makeErrorResponse,
    makeSuccessResponse,
} from "../services/apiService.js"
import {formatPageData, getListPages} from "../services/pageService.js"

const createPage = async (req, res) => {
    console.log("User in request:", req.user);
    try {
        const {name, description, avatarUrl, coverUrl, category} = req.body;
        const errors = [];
        if (!name || !name.trim()){
            errors.push({field:"name", message:"name can be null"});
        }
        if (!category || !category.trim()){
            errors.push({field: "category", message:"category can be null"})
        }
        if (errors.length > 0)
        {
            return makeErrorResponse({res, message: "Invalid form", data: errors})
        }
        const {user} = req;
        let newStatus = 1;
        const page = await Page.create({
            creator: user._id,
            name,
            description,
            avatarUrl: isValidUrl(avatarUrl) ? avatarUrl: null,
            coverUrl: isValidUrl(coverUrl) ? coverUrl : null,
            category,
            status: newStatus,
        })

        // Create page member (owner)
        await PageMember.create({
            page: page._id,
            user: user._id,
            role: 1,  // Role '1' is for the owner
        });

        // Auto follow the page
        await PageFollower.create({
            page: page._id,
            user: user._id,
        });

        // Tự động tạo cài đặt duyệt bài cho page mới
        await createDefaultPageModerationSetting(page._id, user._id);

        return makeSuccessResponse({
            res,
            message: "Create page success"
        })
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
}

const updatePage = async(req, res) =>{
    try {
        const {id, name, description, avatarUrl, coverUrl, category, kind} = req.body;
        const page = await Page.findById(id).populate("creator");
        if  (!page){
            return makeErrorResponse({res, message: "Page not found"});
        }
        if (avatarUrl != page.avatarUrl){
            await deleteFileByUrl(page.avatarUrl);
        }
        if (coverUrl != page.coverUrl){
            await deleteFileByUrl(page.coverUrl);
        }
        await page.updateOne({
            name,
            description,
            avatarUrl : isValidUrl(avatarUrl) ? avatarUrl : null,
            coverUrl : isValidUrl(coverUrl) ? coverUrl : null,
            category,
            kind,
        });
        return makeSuccessResponse({res, message: "Update page success"});
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
}
const getPage = async(req, res) =>{
    try {
        const {id} = req.params;
        const currentUser = req.user;
        const page = await Page.findById(id).populate("creator");
        if (!page) {
            return makeErrorResponse({res, message: "Page not found"});
        }
        return makeSuccessResponse({
            res,
            data: await formatPageData(page, currentUser),
        });
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
}

const getPages = async (req, res)=>{
    try {
        const results = await getListPages(req);
        return makeSuccessResponse({
            res,
            data: results,
        });
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
}

const changeStatusPage = async(req, res) =>{
    try {
        const {id, status, reason} = req.body;
    } catch (error) {
        return makeErrorResponse({res, message: error.message});
    }
}
export {
    createPage,
    updatePage,
    getPage,
    getPages,
};
