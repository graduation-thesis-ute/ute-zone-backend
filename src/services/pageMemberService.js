import mongoose from "mongoose";
import PageMember from "../models/pageMemberModel.js";
import User from "../models/userModel.js";

const formatPageMemberData = (pageMember) => {
    return {
        _id: pageMember._id,
        user: {
            _id: pageMember.user._id,
            displayName: pageMember.user.displayName,
            avatarUrl: pageMember.user.avatarUrl,
        },
        page: {
            _id: pageMember.page._id,
        },
        role: pageMember.role,
    };
};

const getListPageMembers = async(req) => {
    const {
        page,
        isPaged,
        user,
        pageNumber = 0,
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER: 10,
    } = req.query;

    const offset = parseInt(pageNumber, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);

    let query = {};
    if (mongoose.isValidObjectId(page)){
        query.page = new mongoose.Types.ObjectId(page);
    }
    if (mongoose.isValidObjectId(user)){
        query.user = new mongoose.Types.ObjectId(user);
    }
    // if (role){
    //     query.role = role;
    // }       
   // const sortCriteria = sortKind === "1" ? {status: 1, createdAt: -1} : {createdAt: -1};
    const [totalElements, pageMembers] = await Promise.all([
        PageMember.countDocuments(query),
        PageMember.find(query).populate("user page").sort({createAt: 1}).skip(offset).limit(limit),
    ]);
    const totalPages = Math.ceil(totalElements/limit);
    const result = pageMembers.map((pageMember) => {
        return formatPageMemberData(pageMember);
    });

    return {
        content: result,
        totalPages,
        totalElements,
    };
};
const getListMemberOfPage = async (req, pageId) => {
    const {
        page,
        isPaged,
        pageNumber = 0,
        size = isPaged === "0" ? Number.MAX_SAFE_INTEGER : 10,
    } = req.query;

    const offset = parseInt(pageNumber, 10) * parseInt(size, 10);
    const limit = parseInt(size, 10);

    // Lọc các thành viên theo pageId (dành cho trường hợp một trang cụ thể)
    let query = {};
    if (pageId) {
        query.page = pageId; // Không cần convert sang ObjectId vì findById đã xử lý
    }
  
    // Truy vấn các thành viên của một trang cụ thể
    const [totalElements, pageMembers] = await Promise.all([
        PageMember.countDocuments(query), // Đếm tổng số thành viên của trang
        PageMember.find(query).populate("user page").sort({ createdAt: 1 }).skip(offset).limit(limit),
    ]);

    const totalPages = Math.ceil(totalElements / limit);
    
    // Định dạng lại dữ liệu thành viên
    const result = pageMembers.map((pageMember) => {
        return formatPageMemberData(pageMember);
    });

    return {
        content: result,
        totalPages,
        totalElements,
    };
};

export {formatPageMemberData, getListPageMembers, getListMemberOfPage};
