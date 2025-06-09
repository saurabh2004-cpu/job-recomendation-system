const { Server } = require('socket.io')

const joinRoom = async () => {
    const io = new Server({
        cors: true
    })
    io.listen(6001)


    io.on('connection', (soket) => {
        const emailToSoketMapping = new Map()  //email = key and soket = value 
        const soketToEmailMapping = new Map() //soket = key and email= value

        soket.on('join-room', (data) => {
            const { emailId, username, roomId } = data

            console.log("New Connection")
            console.log(`New user joined - ${username} }`)

            //set user email,and soket to map
            emailToSoketMapping.set(emailId, soket.id)
            soketToEmailMapping.set(soket.id, emailId)

            soket.join(roomId)
            soket.emit('joined-room', roomId)   //send member room id that he is joined the room

            soket.broadcast.to(roomId).emit('user-joined', { emailId })   //send meassage to all members of the room

            soket.on('call-user', data => {
                const { emailId, offer } = data   //send this offer to this emailId
                const fromEmail = soketToEmailMapping.get(soket.id)
                const soketId = emailToSoketMapping.get(emailId)

                soket.to(soketId).emit('upcomming-call', { from: fromEmail, offer })
            })

            soket.on('call-accepted', data => {
                const { emailId, answer } = data   //send answer to this email
                const soketId = emailToSoketMapping.get(emailId)

                soket.to(soketId).emit('call-accepted', { answer })
            })
        })
    })
}

module.exports = joinRoom