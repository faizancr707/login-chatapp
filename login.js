
const login = (req, res, _next) => __awaiter(void 0, void 0, void 0, function* () {
    let transaction = yield database_1.default.transaction();
    try {
        const secretKey = process.env.SECRET_KEY || "";
        const isExistingUser = yield user_1.default.findOne({ where: { $phoneNo$: req.body.phoneNo }, transaction });
        if (isExistingUser) {
            const isValidPassword = yield bcrypt_1.default.compare(req.body.password, isExistingUser.password);
            if (!isValidPassword) {
                console.log("Incorrect Password");
                return res.status(401).json({ message: 'Incorrect Password' });
            }
            else {
                const token = jsonwebtoken_1.default.sign({ id: isExistingUser.id }, secretKey);
                const responseData = {
                    id: isExistingUser.id,
                    firstName: isExistingUser.firstName,
                    lastName: isExistingUser.lastName,
                    email: isExistingUser.email,
                    phoneNo: isExistingUser.phoneNo,
                    token: token
                };
                yield transaction.commit();
                console.log(`User ${responseData.firstName} ${responseData.lastName} have Logged IN `);
                return res.status(200).json(responseData);
            }
        }
        else {
            console.log("No user Found");
            yield transaction.rollback();
            return res.status(404).json({ message: "User not Found" });
        }
    }
    catch (error) {
        console.error(error);
        yield transaction.rollback();
        return res.status(500).json({ message: "Internal server Error" });
    }
});
exports.login = login;
