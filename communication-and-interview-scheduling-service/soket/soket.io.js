const { Server } = require('socket.io')
const { publishToQueue, subscribeToQueue, unsubscribeFromQueue } = require("../rabbitMQ/rabbit");
const e = require('cors');

const io = new Server(6002, {
    cors: true
})


const emailToSocketMapping = new Map()  // emailId -> socketId
const socketToEmailMapping = new Map()  // socketId -> emailId
const subscribedEmails = new Set()


io.on('connection', (socket) => {
    console.log('New socket connected:', socket.id)

    // io.sockets.sockets.forEach((socket) => {
    //     socket.disconnect(true);
    // });

    // console.log(io.sockets.sockets)

    // load offline messages
    socket.on('offline-messages', emailId => {
        console.log("offline messages", emailId)

        emailToSocketMapping.set(emailId, socket.id)
        socketToEmailMapping.set(socket.id, emailId)

        //subscribe for offline messages 
        if (!subscribedEmails.has(emailId)) {
            subscribeToQueue(`messages:${emailId}`, (data) => {
                const message = JSON.parse(data)
                console.log("message offline", message)
                console.log("message", message.content, +"from : ", + message.senderName)
                console.log("receiver", emailId, socket.id)

                io.to(socket.id).emit('load-offline-messages', message)
            })
            subscribedEmails.add(emailId)

        }
    })

    // Message event
    socket.on('message', (data) => {
        const { receiverEmailId, senderEmailId, content,senderName } = data

        console.log(`sending message to ${receiverEmailId} from ${senderEmailId} content= ${content}`)

        emailToSocketMapping.set(senderEmailId, socket.id)
        socketToEmailMapping.set(socket.id, senderEmailId)

        // Find the receiver's socket ID
        const receiverSocketId = emailToSocketMapping.get(receiverEmailId)

        console.log("users", emailToSocketMapping)

        // Send message to the receiver
        if (receiverSocketId) {
            console.log("sending message to ", receiverEmailId)
            socket.to(receiverSocketId).emit('message', data)
        } else {
            console.log(`Receiver socket not found for email: ${receiverEmailId}`)
            console.log("storing messages to the queue")
            publishToQueue(`messages:${receiverEmailId}`, JSON.stringify(data))
        }
    })

    //subscribe to queue to get the applicants answer on scheduled interview
    subscribeToQueue('scheduled-interview-answer', data => {
        const interview = JSON.parse(data)
        const { interviewId, recruiterEmailId, answer } = interview

        const receiverSocketId = emailToSocketMapping(recruiterEmailId)
        io.to(receiverSocketId).emit('scheduled-interview-answer', { message: `appllicant wants to ${answer} the interview`, interviewId })

    })

    socket.on('join-room', (data) => {
        const { emailId, username, roomId, joiningUrl, receiverEmailId } = data
        console.log(`User joined - ${username} with email ${emailId}`)

        emailToSocketMapping.set(emailId, socket.id)
        socketToEmailMapping.set(socket.id, emailId)

        io.to(roomId).emit('user-joined', { emailId, socketId: socket.id })
        socket.join(roomId)
        io.to(socket.id).emit('joined-room', roomId)

        const receiverSocketId = emailToSocketMapping.get(receiverEmailId)
        io.to(receiverSocketId).emit('join-to-room', { joiningUrl: joiningUrl })  //notify the receiver applicant
    })

    // call
    socket.on('call-applicant', (data) => {
        const { to, offer } = data
        console.log("calling to applicant ...", to)
        io.to(to).emit('incomming-recruiter-call', { from: socket.id, offer: offer })
        console.log("called to applicant ...", to)
    })

    //accept call
    socket.on('call-accepted', (data) => {
        const { answer, to } = data
        console.log("call-accepte answer:- ")
        console.log("applicant call accepted")

        io.to(to).emit('call-accepted', { answer, from: socket.id })
        console.log("call accepted answer sent to ", to)
    })

    socket.on('peer-nego-needed', (data) => {
        const { to, offer } = data
        console.log("negotiation needed offer")
        io.to(to).emit('peer-nego-needed', { from: socket.id, offer })
    })

    socket.on('peer-nego-done', (data) => {
        const { to, answer } = data
        console.log("peer:negotiation-done")
        io.to(to).emit('peer-nego-final', { from: socket.id, answer })
    })

    socket.on('user-disconnect', ({ to, from }) => {
        io.to(to).emit('user-disconnected', { from: from })
    })

    // Clean up on disconnect
    socket.on('disconnect', () => {
        const email = socketToEmailMapping.get(socket.id)
        if (email) {
            emailToSocketMapping.delete(email)
            socketToEmailMapping.delete(socket.id)
            console.log(`Socket disconnected and mappings cleaned for email: ${email}`)

            //  unsubscribe and remove
            if (!emailToSocketMapping.has(email)) {
                subscribedEmails.delete(email)
                unsubscribeFromQueue(email)
            }
        }
    })
})

module.exports = io
