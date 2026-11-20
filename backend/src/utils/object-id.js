import mongoose from "mongoose";

export const idIsValid = (id) => mongoose.isValidObjectId(id);
