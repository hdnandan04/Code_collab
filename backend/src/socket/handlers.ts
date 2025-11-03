import { Server, Socket } from 'socket.io';
import Room from '../models/Room';
import Message from '../models/Message';
import Snapshot from '../models/Snapshot';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', async (socket: Socket) => {
    const { roomId, username } = socket.handshake.query as { roomId: string; username: string };
    
    console.log(`👤 User ${username} connecting to room ${roomId}`);

    if (!roomId || !username) {
      console.log('❌ Missing roomId or username');
      socket.disconnect();
      return;
    }

    try {
      // Join Socket.IO room
      await socket.join(roomId);

      // Find or create room in database
      let room = await Room.findOne({ roomId });
      
      const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const participant = {
        socketId: socket.id,
        username,
        color: userColor,
        joinedAt: new Date(),
      };

      if (!room) {
        room = await Room.create({
          roomId,
          participants: [participant],
          currentCode: '// Start coding together!',
          language: 'javascript', // Default language on creation
          version: 0,
        });
        console.log(`✅ Created new room: ${roomId}`);
      } else {
        room.participants.push(participant);
        room.lastActivity = new Date();
        await room.save();
        console.log(`✅ User joined existing room: ${roomId}`);
      }

      // Send current state to new user
      // ** ALSO SEND THE CURRENT LANGUAGE **
      socket.emit('code-snapshot', room.currentCode);
      socket.emit('language-update', room.language); // Send current lang to new user
      
      // Load chat history
      const messages = await Message.find({ roomId })
        .sort({ timestamp: 1 })
        .limit(100);
      socket.emit('chat-history', messages);

      // Notify room about new participant
      const participantsList = room.participants.map((p) => ({
        id: p.socketId,
        username: p.username,
        color: p.color,
      }));

      socket.emit('room-joined', { participants: participantsList });
      socket.to(roomId).emit('user-joined', {
        id: socket.id,
        username,
        color: userColor,
      });

      console.log(`📋 Participants in ${roomId}:`, participantsList.map(p => p.username).join(', '));

      // Handle code changes with simple versioning
      socket.on('code-change', async (data: { roomId: string; code: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            room.currentCode = data.code;
            room.version += 1;
            room.lastActivity = new Date();
            await room.save();

            // Broadcast to all other users in room
            socket.to(data.roomId).emit('code-update', data.code);
            console.log(`📝 Code updated in ${data.roomId} (version ${room.version})`);
          }
        } catch (error) {
          console.error('Error updating code:', error);
        }
      });

      //
      // --- NEW HANDLER ADDED HERE ---
      //
      socket.on('language-change', async (data: { roomId: string; language: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            room.language = data.language;
            room.lastActivity = new Date();
            await room.save();

            // Broadcast to all other users in room
            socket.to(data.roomId).emit('language-update', data.language);
            console.log(`🌐 Language updated in ${data.roomId} to ${data.language}`);
          }
        } catch (error) {
          console.error('Error updating language:', error);
        }
      });
      //
      // --- END OF NEW HANDLER ---
      //

      // Handle chat messages
      socket.on('chat-message', async (data: { roomId: string; message: any }) => {
        try {
          const message = await Message.create({
            roomId: data.roomId,
            username: data.message.username,
            text: data.message.text,
            timestamp: new Date(data.message.timestamp),
          });

          // Broadcast to all users in room including sender
          io.to(data.roomId).emit('chat-message', message);
          console.log(`💬 Chat message in ${data.roomId} from ${data.message.username}`);
        } catch (error) {
          console.error('Error saving message:', error);
        }
      });

      // Handle cursor positions (ephemeral - not stored)
      socket.on('cursor-position', (data: { roomId: string; position: any }) => {
        socket.to(data.roomId).emit('cursor-update', {
          userId: socket.id,
          username,
          position: data.position,
        });
      });

      // Handle snapshot requests (save current state)
      socket.on('request-snapshot', async (data: { roomId: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            await Snapshot.create({
              roomId: data.roomId,
              code: room.currentCode,
              language: room.language,
              version: room.version,
              createdBy: username,
            });
            socket.emit('snapshot-saved', { success: true });
            console.log(`📸 Snapshot saved for ${data.roomId}`);
          }
        } catch (error) {
          console.error('Error saving snapshot:', error);
          socket.emit('snapshot-saved', { success: false, error });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`👋 User ${username} disconnected from room ${roomId}`);
        
        try {
          const room = await Room.findOne({ roomId });
          if (room) {
            room.participants = room.participants.filter(
              (p) => p.socketId !== socket.id
            );
            
            if (room.participants.length === 0) {
              console.log(`🗑️  Room ${roomId} is now empty`);
            } else {
              await room.save();
            }

            socket.to(roomId).emit('user-left', socket.id);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    } catch (error) {
      console.error('Error in socket connection:', error);
      socket.disconnect();
    }
  });
};