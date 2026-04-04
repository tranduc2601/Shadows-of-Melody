-- Insert Artists
INSERT INTO artists (name, bio, image_url, followers_count) VALUES 
('The Beatles', 'Iconic British rock band', 'https://via.placeholder.com/200?text=Beatles', 5000000),
('Taylor Swift', 'American pop/country singer', 'https://via.placeholder.com/200?text=Taylor', 3000000),
('Ed Sheeran', 'British singer-songwriter', 'https://via.placeholder.com/200?text=EdSheeran', 2500000),
('Billie Eilish', 'American singer', 'https://via.placeholder.com/200?text=Billie', 2000000),
('The Weeknd', 'Canadian producer', 'https://via.placeholder.com/200?text=Weeknd', 1800000);

-- Insert Albums
INSERT INTO albums (title, artist_id, cover_url, release_date, description) VALUES 
('Abbey Road', 1, 'https://via.placeholder.com/300', '1969-09-26', 'The Beatles final album'),
('1989', 2, 'https://via.placeholder.com/300', '2014-10-27', 'Taylor Swift album'),
('÷ (Divide)', 3, 'https://via.placeholder.com/300', '2017-03-03', 'Ed Sheeran album'),
('When We All Fall Asleep', 4, 'https://via.placeholder.com/300', '2019-03-29', 'Billie Eilish debut'),
('After Hours', 5, 'https://via.placeholder.com/300', '2020-03-20', 'The Weeknd album');

-- Insert Genres
INSERT INTO genres (name, description) VALUES 
('Rock', 'Rock music'),
('Pop', 'Pop music'),
('Country', 'Country music'),
('Hip-Hop', 'Hip-hop'),
('R&B', 'R&B music');

-- Insert Songs
INSERT INTO songs (title, album_id, duration, file_url, file_size, cover_url, plays_count) VALUES 
('Come Together', 1, 259, 'songs/come_together.mp3', 5242880, 'https://via.placeholder.com/200', 1500000),
('Something', 1, 183, 'songs/something.mp3', 3932160, 'https://via.placeholder.com/200', 1200000),
('Here Comes the Sun', 1, 185, 'songs/here_comes_sun.mp3', 3932160, 'https://via.placeholder.com/200', 2000000),
('Shake It Off', 2, 211, 'songs/shake_it_off.mp3', 4500000, 'https://via.placeholder.com/200', 850000),
('Blank Space', 2, 231, 'songs/blank_space.mp3', 4718000, 'https://via.placeholder.com/200', 1100000),
('Style', 2, 231, 'songs/style.mp3', 4718000, 'https://via.placeholder.com/200', 750000),
('Shape of You', 3, 233, 'songs/shape_of_you.mp3', 4734080, 'https://via.placeholder.com/200', 950000),
('Thinking Out Loud', 3, 282, 'songs/thinking_out_loud.mp3', 5668864, 'https://via.placeholder.com/200', 880000),
('when the party''s over', 4, 196, 'songs/when_partys_over.mp3', 3932160, 'https://via.placeholder.com/200', 620000),
('bad guy', 4, 194, 'songs/bad_guy.mp3', 3932160, 'https://via.placeholder.com/200', 1350000),
('Blinding Lights', 5, 200, 'songs/blinding_lights.mp3', 4038656, 'https://via.placeholder.com/200', 1600000),
('The Weeknd - Heartless', 5, 200, 'songs/heartless.mp3', 4038656, 'https://via.placeholder.com/200', 920000);

-- Link songs to artists
INSERT INTO song_artists (song_id, artist_id) VALUES 
(1, 1), (2, 1), (3, 1),
(4, 2), (5, 2), (6, 2),
(7, 3), (8, 3),
(9, 4), (10, 4),
(11, 5), (12, 5);

-- Link songs to genres
INSERT INTO song_genres (song_id, genre_id) VALUES 
(1, 1), (2, 1), (3, 1),
(4, 2), (5, 2), (6, 2),
(7, 2), (8, 2),
(9, 2), (10, 2),
(11, 2), (12, 5);

-- Insert Users
INSERT INTO users (username, email, password_hash, full_name, is_admin, is_verified) VALUES 
('admin', 'admin@app.com', '$2a$10$yjHs1.E6zl/yVuZX/E3n8OCmG9XBzQQ.6T7Nj3gZP8e6m9s5Z8Gxy', 'Admin', TRUE, TRUE),
('user1', 'user1@app.com', '$2a$10$yjHs1.E6zl/yVuZX/E3n8OCmG9XBzQQ.6T7Nj3gZP8e6m9s5Z8Gxy', 'User One', FALSE, TRUE);

-- Insert Playlists
INSERT INTO playlists (user_id, name, description, is_public) VALUES 
(2, 'My Favorites', 'My favorite songs', TRUE),
(2, 'Workout Mix', 'For gym sessions', TRUE);

-- Add songs to playlists
INSERT INTO playlist_songs (playlist_id, song_id) VALUES 
(1, 1), (1, 4), (1, 8),
(2, 10), (2, 11);

-- Insert Favorites
INSERT INTO favorites (user_id, song_id) VALUES 
(2, 1), (2, 4), (2, 8), (2, 11);

-- Insert Subscriptions
INSERT INTO subscriptions (user_id, subscription_type, start_date, is_active) VALUES 
(1, 'vip', CURDATE(), TRUE),
(2, 'premium', CURDATE(), TRUE);