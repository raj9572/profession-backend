import fs from 'fs'
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'



const generateAccessAndRefreshToken = async(userId)=>{

        try {
             const user = await User.findById(userId)
             const accessToken= await user.generateAccessToken()
             const refreshToken = await user.generateRefreshToken()

              user.refreshToken = refreshToken
                
              await user.save({ validateBeforeSave: false })

            return {accessToken,refreshToken}

        } catch (error) {
            throw new ApiError(500,"Something went wronge while generate access token and refreh token")
        }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists :  username, email
    // check for images , check for avatar
    // upload them to cloudinary, avatar
    // create user object -- create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { username, email, fullName, password } = req.body
    //    console.log("req body",req.body)
    // console.log('object1')

    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with email or username already exists")
    }

    // console.log("request file multer",req.files)

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    console.log('object2')

    if (!avatarLocalPath) {
      
        throw new ApiError(400, "Avatar file is required")
    }
    console.log('object3')

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }



    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wronge while register a user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )



})



const loginUser = asyncHandler(async(req,res)=>{

    // req body -> data
    // username or email
    //find the user
    // passowrd check
    //access token and refresh token
    // send cookies


     const {username,email,password} = req.body

     if(!username && !email){
        throw new ApiError(400,"username or email is required")
     }

     // Here is an alternatie of above code based on logic discussion
    //  if(!(username || email)){
    //     throw new ApiError(400,"username or email is required")
    //  }

     const user = await User.findOne({
        $or:[{username},{email}]
     })

     if (!user) {
        throw new ApiError(404,"user does not exist")
     }

     const isPasswordValid = await user.isPasswordCorrect(password)

     if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credential")
     }

     const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

     const loggedInUser = await User.findById(user._id).select("-password -refreshToken")


      const options = {
         httpOnly:true,
         secure:true
      }

      // appke cookies ko by default koi bhi modified ke skta h frontend m... bt option se cookies only server se modified ke skte h ...front end se nahi 

      return  res.status(200)
      .cookie("refreshToken",refreshToken,options)
      .cookie("accessToken",accessToken,options)
      .json(new ApiResponse(
        200,
        {
            user:loggedInUser,accessToken,refreshToken
        },
        "user is login successfully"
      ))



})


const logoutUser = asyncHandler(async(req,res)=>{
       await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
      )

      const options = {
        httpOnly:true,
        secure:true
      }

      return res.status(200)
      .clearCookie("accessToken",options)
      .clearCookie("refreshToken",options)
      .json(new ApiResponse(200,{},"user looged out"))



})


const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }

    try {
         const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
         const user = await User.findById(decodedToken._id)
    
         if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} =await generateAccessAndRefreshToken(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,
            {
            accessToken,
            refreshToken:newRefreshToken
             },
             "Access token refreshed"
        ))
    
    
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh Token")
    }
})


const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password Changed Successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    //  const CurrentUser = await User.findById(req.user._id).select("-password -refreshToken")
    return res.status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))

})


const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body

    if(!fullName || !email){
        throw new ApiError("400","All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },
        {new:true}
        ).select("-password -refreshToken")

        return res.status(200)
        .json(new ApiResponse(200,user,"Account Details Updated Successfully"))

})


const updateUserAvatar = asyncHandler(async(req,res)=>{

    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
        ).select("-password")

        return res.status(200)
    .json(new Response(200,user,"coverImage Updated successfully"))
})


const updateUserCoverImage = asyncHandler(async(req,res)=>{

    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400,"Avatar file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
        ).select("-password")

    return res.status(200)
    .json(new Response(200,user,"coverImage Updated successfully"))
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
 }