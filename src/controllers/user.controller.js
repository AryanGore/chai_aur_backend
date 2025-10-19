import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { UploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const RefreshToken = user.generateRefreshToken();

        user.RefreshToken = RefreshToken;
        await user.save({ validateBeforeSave : false });
        return {accessToken , RefreshToken};
        
    } catch (error) {
        throw new ApiError(500 , "Something Went Wrong while generating Access and Refresh Tokens.");
    }
}

const registerUser = asyncHandler(async (req , res) => {
    // res.status(200).json({
    //     message: "chai aur code vackend OHK!"
    // })

    // Algorithm for Register User , highly replicavle.

    //get user details from frontend
    //validation - not empty.
    //check if user already exists: username , email.
    //check for images , check for avatar.
    //upload them to cloudinary, check avatar again.
    //create user Ovject - create entry in datavase.
    //remove password and refresh token field from response
    //check for user creation.
    //retur response.

    const {fullname , username , email , password} = req.body;
    // console.log("email: ", email);

    if(
        [fullname , email , username , password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400 , "All fields are required.");
    }

    const existedUser = await User.findOne(
        {
            $or: [{username},{email}]
        }
    )

    if(existedUser){
        throw new ApiError(409 , "username or email should already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; //directly using this gives errors
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is required.");
    }

    const avatar = await UploadOnCloudinary(avatarLocalPath);
    const coverImage = await UploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400 , "Avatar file is required.");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        password,
        email
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500 , "something went wrong while registering user.");
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User Registered Successfully.")
    )


})


const loginUser = asyncHandler(async (req,res) => {
    //  algorithm : 
    //get req vody -> data
    // username or email (for finding the user).
    //find the user
    //check the password.
    //generate access and refresh token.
    //send cookie

    const {email , username , password} = req.body;

    if(!email || !username){
        throw new ApiError(400 , "username or email is required! ");
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404 , "User does not exist.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid User Credentials");
    }

    const {accessToken , RefreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , RefreshToken ,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser , accessToken , RefreshToken
            },
            "User logged In Successfully."
        )
    )
})

const logoutUser = asyncHandler(async(req ,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                RefreshToken: undefined
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200 , {} , "User logged Out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
};