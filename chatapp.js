export const currentUser = async (req:CurentUserRequest, res:Response, _next:NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const isExistingUser = await User.findOne({where :{$id$: req.body.id}});
        if(!isExistingUser) {
            await transaction.rollback();
            return res.status(404).json({message: "User Details not found"});
        } else {
            const responseData =  {
                id: isExistingUser.id,
                firstName: isExistingUser.firstName,
                lastName: isExistingUser.lastName,
                email: isExistingUser.email,
                phoneNo: isExistingUser.phoneNo,
            }
            await transaction.commit();
            return res.status(200).json(responseData);
        }
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const addContact = async (req:AddContactRequest, res:Response, _next:NextFunction)=> {
    let transaction = await sequelize.transaction();
    try {
        const isExistingUser = await User.findOne({where: {$phoneNo$: req.body.phoneNo}, transaction})
        if(!isExistingUser) {
            await transaction.rollback();
            return res.status(404).json({message: "User Details not found"});
        } else {
            const sender = await User.findOne( {where: {$id$: req.body.UserId}, transaction} );
            if(sender) {
                await Invites.create( {
                    senderId: sender.id ,
                    receiverId: isExistingUser.id,
                    inviteType: 'private',
                    otherDetails: sender.firstName + sender.lastName
                }, {transaction} );
            };
            await transaction.commit();
            return res.status(201).json({message: "Invite has been send "});
        }
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const getAllContacts = async (req:GetAllContactsRequest, res:Response, _next:NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const contacts = await Contacts.findAll({where: {$UserId$: req.body.UserId} , transaction});
        transaction.commit();
        console.log("Fetched all contacts successfully")
        return res.status(200).json(contacts);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const addGroup = async  (req:addGroupRequest, res:Response, _next:NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const group = await Groups.create( { 
            groupName: req.body.groupName,
            UserId: req.body.UserId
        }, {transaction});
        const groupMembers = req.body.groupMembers;
        const groupMembersPromises = groupMembers.map(async (memberId: string) => {
            await GroupMembers.create({
                contactId: memberId,
                GroupId: group.id,
                groupName: req.body.groupName
            }, { transaction });
        });
        
        await Promise.all(groupMembersPromises);
        await Groups.update( {groupId: group.id}, {where: {$id$:group.id}, transaction} );
        await transaction.commit();
        console.log(`Added group: ${req.body.groupName}`);
        return res.status(201).json(group);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const getAllGroups = async  (req:GetAllGroupsRequest, res: Response, _next: NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const adminGroupsPromise = Groups.findAll({where: {$UserId$: req.body.UserId}, transaction})
        const membersGroupsPromise =  GroupMembers.findAll( {where: {$contactId$: req.body.UserId}, transaction} );

        const [adminGroups, membersGroups] = await Promise.all([adminGroupsPromise, membersGroupsPromise]);
        const adminGroupsModified = adminGroups.map(group => ({ ...group.toJSON(), isAdmin: true, GroupId: group.id }));
        const membersGroupsModified = membersGroups.map(group => ({ ...group.toJSON(), isAdmin: false }));

        const responseData = [...adminGroupsModified, ...membersGroupsModified];
        await transaction.commit();
        console.log("Fetched all Groups successfully")
        return res.status(200).json(responseData);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const getAllGroupMembers =  async ( req:Request, res:Response, _next: NextFunction )=> {
    let transaction = await sequelize.transaction();
    try {
        const groupId = req.params.groupId;
        const isAdmin = await Groups.findOne( {where: {$id$ : groupId}, transaction} );
       
        if(isAdmin && req.body.UserId === isAdmin.UserId ){

            const allGroupMembers = await GroupMembers.findAll( {where: {$GroupId$: groupId}, transaction} );
            const responseData = [];
            for( const member of allGroupMembers) {
                const contact = await Contacts.findOne( {where: {$UserId$: req.body.UserId, $contactId$: member.contactId}, transaction} );
                if(contact) {
                    responseData.push(contact);
                };
            };
            await transaction.commit();
            return res.status(200).json(responseData);
        } else {
            await transaction.rollback();
            return res.status(403).json({message : "Unauthorized Access: User is not an Admin"});
        }
        
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const getAllAdmins = async (req:Request, res: Response, _next:NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const groupId = req.params.groupId;
        const admins = await Groups.findAll({where : {groupId: groupId}, transaction});

        const adminsDetailsPromises = admins.map(async (admin) => {
            const user = await User.findOne({ where: { id: admin.UserId },
                attributes: ['id', 'firstName', 'lastName'], transaction });
            return user; 
        });
        const adminsDetails = await Promise.all(adminsDetailsPromises);

        console.log(adminsDetails);
        await transaction.commit();
        return res.status(200).json(adminsDetails);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
};


export const adminOperations = async (req:adminOperationsReqest, res:Response, _next: NextFunction) => {
    let transaction = await sequelize.transaction();

    try {
        const isAdmin = await Groups.findOne( {where: {$id$ : req.body.groupId}, transaction} );
        if(isAdmin && req.body.UserId === isAdmin.UserId) {
            if(req.body.opsType === "editGroupName") {
                await isAdmin.update( {groupName: req.body.groupName}, {transaction});
                await transaction.commit();
                return res.status(201).json(req.body);
            } else if ( req.body.opsType === "addMembers" ) {
                await Promise.all(req.body.selectedMembers.map(async (member) => {
                    await Invites.create({
                        senderId: req.body.groupId,
                        receiverId: member,
                        inviteType: "group",
                        otherDetails: isAdmin.groupName
                    }, { transaction });
                }));
                await transaction.commit();
                return res.status(201).json(req.body);
            } else if ( req.body.opsType === "removeMembers" ) {
                req.body.selectedMembers.forEach( (member) => {
                    GroupMembers.destroy( {where: {$contactId$: member, $GroupId$: req.body.groupId}} );
                } );
                await transaction.commit();
                return res.status(201).json(req.body);
            } else if(req.body.opsType === 'addAdmin') {
                const { selectedMembers, groupId, groupName } = req.body;

                for(const memberId of selectedMembers) {
                    await Groups.create( {
                        groupName:groupName,
                        groupId:groupId,
                        UserId: memberId
                    }, {transaction} );

                    await GroupMembers.destroy( { 
                        where: {
                            contactId: memberId,
                            GroupId: groupId,
                            groupName: groupName
                        }, transaction
                    } )
                };
                await transaction.commit();
                return res.status(201).json(req.body);
            } else if ( req.body.opsType === 'removeAdmin') {
                const { selectedMembers, groupId, groupName } = req.body;

                for(const memberId of selectedMembers) {
                    await Groups.destroy( {
                        where: {
                            $groupId$: groupId,
                            $groupName$: groupName,
                            $UserId$: memberId
                        }, transaction
                    } );

                    await GroupMembers.create( {
                        contactId:memberId,
                        groupName:groupName,
                        GroupId:groupId
                    }, {transaction} );
                };
                await transaction.commit();
                return res.status(201).json(req.body);

            }
        } else {
            await transaction.rollback();
            return res.status(403).json( {message: "Unauthorized Access: User is not an Admin"} );
        }

        console.log(req.body);
        await transaction.commit();
        return res.status(201).json(req.body);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const leaveGroup = async (req:Request, res:Response, _next:NextFunction ) => {
    let transaction = await sequelize.transaction();
    try {
        const groupId= req.params.groupId;
        await GroupMembers.destroy( {where: {$GroupId$: groupId, contactId: req.body.UserId }, transaction} );
        transaction.commit();
        return res.status(201).json({message: "User have left the group"});
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const getAllInvites = async (req:Request, res:Response, _next:NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        const allInvites =  await Invites.findAll({where: {$receiverId$: req.body.UserId}});
       
        await transaction.commit();
        return res.status(200).json(allInvites);
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({message: "Internal Server Error"});
    }
}

export const responseInvites = async (req: ResponseInvites, res: Response, _next: NextFunction) => {
    let transaction = await sequelize.transaction();
    try {
        if (req.body.invite.response === false) {
            await Invites.destroy({ where: { id: req.body.invite.id }, transaction });
            await transaction.commit();
            return res.status(201).json({ message: "Invite has been declined" });
        } else {
            if (req.body.invite.inviteType === 'group') {
                await GroupMembers.create({
                    contactId: req.body.UserId,
                    groupName: req.body.invite.otherDetails,
                    GroupId: req.body.invite.senderId
                }, { transaction });
                await Invites.destroy({ where: { id: req.body.invite.id }, transaction });
                await transaction.commit();
                return res.status(201).json({ message: "Group membership added" });
            } else if (req.body.invite.inviteType === 'private') {
                const currentUser = await User.findOne({ where: { id: req.body.UserId }, transaction });
                const senderUser = await User.findOne({ where: { id: req.body.invite.senderId }, transaction });

                if (currentUser && senderUser) {
                    await Contacts.create({
                        firstName: senderUser.firstName,
                        lastName: senderUser.lastName,
                        phoneNo: senderUser.phoneNo,
                        contactId: senderUser.id,
                        UserId: currentUser.id
                    }, { transaction });

                    await Contacts.create({
                        firstName: currentUser.firstName,
                        lastName: currentUser.lastName,
                        phoneNo: currentUser.phoneNo,
                        contactId: currentUser.id,
                        UserId: senderUser.id
                    }, { transaction });
                }

                await Invites.destroy({ where: { id: req.body.invite.id }, transaction });
                await transaction.commit();
                return res.status(201).json({ message: "Contacts have been added" });
            }
            await transaction.rollback();
            return res.status(403).json({ message: "Unauthorized Access" });
        }
    } catch (error) {
        console.error(error);
        await transaction.rollback();
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
