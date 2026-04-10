import app from './src/app.js';
import config from './src/config/env.js';

const PORT = config.server.port;

const server = app.listen(PORT, () => {
    console.log(`
        Shadows of Melody Backend Server Started             
                                                              
   Server: http://localhost:${PORT}                           
   Status: http://localhost:${PORT}/health                                            
   CORS Origin: ${config.cors.origin}                           
                                                                
   API Endpoints:                                               
   • POST   /api/auth/register                               
   • POST   /api/auth/login                                  
   • GET    /api/auth/me                                     
   • GET    /api/songs                                       
   • GET    /api/songs/search?q=                             
   • GET    /api/artists                                     
   • GET    /api/albums                                      
   • GET    /api/playlists                                   
   • GET    /api/favorites                                   
   • GET    /api/history                                     
   • GET    /api/stream/:songId                              
   • GET    /api/subscriptions                               
    `);
});


process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

export default server;
