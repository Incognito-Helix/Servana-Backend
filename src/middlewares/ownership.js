const requireOwnership = (getOwnerId) => {
    return (req, res, next) => {
        //ownership authorization logic implemented here.
        next();
    };
};

export default requireOwnership;