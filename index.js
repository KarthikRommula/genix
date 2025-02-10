// Database configuration
let db;
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 2; // Incremented for hash index
const STORE_NAME = 'songs';

// DOM Elements
const image = document.getElementById('cover');
const title = document.getElementById('music-title');
const artist = document.getElementById('music-artist');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progress = document.getElementById('progress');
const playerProgress = document.getElementById('player-progress');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const playBtn = document.getElementById('play');
const background = document.getElementById('bg-img');
const shuffleBtn = document.getElementById('shuffle');
const playlistBtn = document.getElementById('playlist');

// Audio initialization
const music = new Audio();

// Default songs
const defaultSongs = [
    {
        path: 'songs/1.mp3',
        displayName: 'The Charmer\'s Call',
        cover: 'songs/2.jpg',
        artist: 'Hanu Dixit',
    },
];

// Initialize songs array with default songs
let songs = [...defaultSongs];
let musicIndex = 0;
let isPlaying = false;
let queue = [];
// Database Functions
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('displayName', 'displayName', { unique: false });
                store.createIndex('artist', 'artist', { unique: false });
                store.createIndex('hash', 'hash', { unique: true });
            } else if (event.oldVersion < 2) {
                const store = event.target.transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('hash')) {
                    store.createIndex('hash', 'hash', { unique: true });
                }
            }
        };
    });
}
function displayQueue() {
    let queueSection = document.getElementById('queue-section');
    if (!queueSection) {
        queueSection = document.createElement('div');
        queueSection.id = 'queue-section';
        queueSection.innerHTML = `
            <div class="queue-header">
                <h3>Queue</h3>
                <span class="queue-subtitle">Next in queue</span>
            </div>
        `;
        playlistContainer.parentNode.insertBefore(queueSection, playlistContainer.nextSibling);
    }

    queueSection.innerHTML = `
        <div class="queue-header">
            <h3>Queue</h3>
            <span class="queue-subtitle">Next in queue</span>
        </div>
    `;

    if (queue.length > 0) {
        const queueList = document.createElement('ul');
        queueList.id = 'queue-list';

        queue.forEach((song, index) => {
            const queueItem = document.createElement('li');
            queueItem.innerHTML = `
                <div class="queue-item">
                    <div class="queue-item-info">
                        <img src="${song.cover}" alt="cover" class="queue-cover">
                        <div class="queue-text">
                            <span class="queue-title">${song.displayName}</span>
                            <span class="queue-artist">${song.artist}</span>
                        </div>
                    </div>
                    <button class="remove-from-queue" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            const removeBtn = queueItem.querySelector('.remove-from-queue');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(index);
            });

            queueList.appendChild(queueItem);
        });

        queueSection.appendChild(queueList);
    } else {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty-queue';
        emptyMessage.textContent = 'Your queue is empty';
        queueSection.appendChild(emptyMessage);
    }
}


function addToQueue(song) {
    if (!song) return;
    queue.push({ ...song });
    showNotification('Added to queue: ' + song.displayName, 'success');
    displayQueue();
}


function removeFromQueue(index) {
    queue.splice(index, 1);
    displayQueue();
}
function playNext() {
    if (queue.length > 0) {
        // Priority to manually queued songs
        const nextSong = queue.shift();
        const songIndex = songs.findIndex(song =>
            song.id === nextSong.id ||
            (song.path === nextSong.path && song.displayName === nextSong.displayName)
        );

        if (songIndex !== -1) {
            musicIndex = songIndex;
            loadMusic(songs[musicIndex]);
            playMusic();
        }
    } else {
        // If no songs in queue, play next in playlist
        changeMusic(1);
    }
    displayQueue();
}
music.addEventListener('ended', playNext);
async function loadSongsFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const dbSongs = request.result;
            songs = [...defaultSongs, ...dbSongs];
            resolve(songs);
        };

        request.onerror = () => reject(request.error);
    });
}

async function storeSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(song);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            if (request.error.name === 'ConstraintError') {
                reject(new Error('This song has already been uploaded.'));
            } else {
                reject(request.error);
            }
        };
    });
}

async function deleteSong(songId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(songId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Player Functions
function togglePlay() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function playMusic() {
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
    playBtn.setAttribute('title', 'Pause');
    music.play();
}

function pauseMusic() {
    isPlaying = false;
    playBtn.classList.replace('fa-pause', 'fa-play');
    playBtn.setAttribute('title', 'Play');
    music.pause();
}
function loadMusic(song) {
    music.src = song.path;
    title.textContent = song.displayName;
    artist.textContent = song.artist;
    image.src = song.cover;
    background.src = song.cover;
    updateMediaSession(song);
}
function changeMusic(direction) {
    if (direction > 0 && queue.length > 0) {
        // Play from queue if going forward
        playNext();
    } else {
        // Normal playlist navigation
        musicIndex = (musicIndex + direction + songs.length) % songs.length;
        loadMusic(songs[musicIndex]);
        playMusic();
    }
}

function updateProgressBar() {
    const { duration, currentTime } = music;
    if (isNaN(duration)) return;

    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;

    const formatTime = (time) => String(Math.floor(time)).padStart(2, '0');
    durationEl.textContent = `${formatTime(duration / 60)}:${formatTime(duration % 60)}`;
    currentTimeEl.textContent = `${formatTime(currentTime / 60)}:${formatTime(currentTime % 60)}`;
}

function setProgressBar(e) {
    const width = playerProgress.clientWidth;
    const clickX = e.offsetX;
    music.currentTime = (clickX / width) * music.duration;
}

// Playlist Functions
const playlistModal = document.createElement('div');
playlistModal.id = 'playlist-modal';
playlistModal.innerHTML = `
    <div class="playlist-content">
        <span id="close-playlist" class="close-playlist"><i class="fas fa-times"></i></span>
        <h2> Playlist</h2>
        <ul id="playlist-container"></ul>
        <button id="upload"><i class="fas fa-box-open"></i></button>
    </div>
`;
document.body.appendChild(playlistModal);

const playlistContainer = document.getElementById('playlist-container');
const closePlaylistBtn = document.getElementById('close-playlist');
const uploadBtn = document.getElementById('upload');

function displayPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = '';

    // Create main playlist section
    const playlistSection = document.createElement('div');
    playlistSection.id = 'playlist-section';

    // Display songs
    const songsList = document.createElement('ul');
    songsList.id = 'queue-list';

    songs.forEach((song, index) => {
        const songItem = document.createElement('li');
        songItem.className = 'queue-item';

        // Create song info container
        const songInfoDiv = document.createElement('div');
        songInfoDiv.className = 'queue-item-info';

        // Add cover image if available
        const coverImg = document.createElement('img');
        coverImg.src = song.coverUrl || '/songs/2.jpg'; // Add a default cover image path
        coverImg.className = 'queue-cover';
        coverImg.alt = `${song.displayName} cover`;
        songInfoDiv.appendChild(coverImg);
        // Create text container
        const textDiv = document.createElement('div');
        textDiv.className = 'queue-text';

        // Add title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'queue-title';
        titleSpan.textContent = song.displayName;

        // Add artist
        const artistSpan = document.createElement('span');
        artistSpan.className = 'queue-artist';
        artistSpan.textContent = song.artist;

        textDiv.appendChild(titleSpan);
        textDiv.appendChild(artistSpan);
        songInfoDiv.appendChild(textDiv);

        // Add click event for playing
        songInfoDiv.addEventListener('click', () => {
            musicIndex = index;
            loadMusic(songs[index]);
            playMusic();
            togglePlaylist();
        });

        songItem.appendChild(songInfoDiv);

        // Create buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'queue-item-buttons';

        // Add to queue button
        const queueBtn = document.createElement('button');
        queueBtn.innerHTML = '<i class="fas fa-plus"></i>';
        queueBtn.className = 'remove-from-queue';
        queueBtn.title = 'Add to Queue';
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToQueue(song);
        });
        buttonsDiv.appendChild(queueBtn);

        // Delete button (if song has ID)
        if (song?.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'remove-from-queue';
            deleteBtn.title = 'Delete Song';

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                const userConfirmed = await showConfirmDialog('Are you sure you want to delete this song?');
                if (!userConfirmed) return;

                try {
                    await deleteSong(song.id);
                    await loadSongsFromDB();
                    displayPlaylist();

                    if (musicIndex === index) {
                        musicIndex = 0;
                        loadMusic(songs[0] || null);
                        if (isPlaying && songs.length > 0) playMusic();
                    }

                    showNotification('Song deleted successfully', 'success');
                } catch (error) {
                    console.error('Error deleting song:', error);
                    showNotification('Error deleting song. Please try again.', 'error');
                }
            });

            buttonsDiv.appendChild(deleteBtn);
        }

        songItem.appendChild(buttonsDiv);
        songsList.appendChild(songItem);
    });

    playlistContainer.appendChild(songsList);

    // Create and display queue section
    const queueSection = document.createElement('div');
    queueSection.id = 'queue-section';

    const queueHeader = document.createElement('div');
    queueHeader.className = 'queue-header';

    const queueTitle = document.createElement('h3');
    queueTitle.textContent = 'Queue';

    const queueSubtitle = document.createElement('div');
    queueSubtitle.className = 'queue-subtitle';

    queueHeader.appendChild(queueTitle);
    queueHeader.appendChild(queueSubtitle);
    queueSection.appendChild(queueHeader);

    // Display queue
    if (queue.length > 0) {
        const queueList = document.createElement('ul');
        queueList.id = 'queue-list';

        queue.forEach((song, index) => {
            // Similar structure as above for queue items
            const queueItem = document.createElement('li');
            queueItem.className = 'queue-item';
            // ... (repeat similar structure as song items but with remove from queue instead of add to queue)
        });

        queueSection.appendChild(queueList);
    } else {
        const emptyQueue = document.createElement('div');
        emptyQueue.className = 'empty-queue';
        emptyQueue.textContent = 'Your queue is empty';
        queueSection.appendChild(emptyQueue);
    }

    playlistContainer.appendChild(queueSection);
}
function togglePlaylist() {
    playlistModal.classList.toggle('open');
    if (playlistModal.classList.contains('open')) {
        displayPlaylist();
    }
}

// File handling functions
async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkSongExists(songName, hash) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const hashIndex = store.index('hash');
        const hashRequest = hashIndex.count(hash);

        hashRequest.onsuccess = () => {
            if (hashRequest.result > 0) {
                resolve({ exists: true, reason: 'content' });
                return;
            }

            const nameIndex = store.index('displayName');
            const nameRequest = nameIndex.count(songName);

            nameRequest.onsuccess = () => {
                resolve({ exists: nameRequest.result > 0, reason: 'name' });
            };
            nameRequest.onerror = () => reject(nameRequest.error);
        };

        hashRequest.onerror = () => reject(hashRequest.error);
    });
}

async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
        showNotification('Please upload valid audio files.', 'error');
        return;
    }

    for (const file of files) {
        if (!file.type.startsWith('audio/')) {
            showNotification(`Skipping invalid file: ${file.name}. Please upload a valid audio file.`, 'error');
            continue;
        }

        try {
            const hash = await calculateFileHash(file);

            // Remove [SPOTDOWNLOADER.COM] prefix from song name
            let songName = file.name.replace(/\.[^/.]+$/, '');
            songName = songName.replace(/^\[SPOTDOWNLOADER\.COM\]\s*/, '');
            songName = songName.replace(/\s*\(.*\)$/, '');

            const { exists, reason } = await checkSongExists(songName, hash);
            if (exists) {
                showNotification(
                    reason === 'content'
                        ? `Skipping duplicate song: ${songName}.`
                        : `Skipping duplicate song: ${songName} (same content).`,
                    'error'
                );
                continue;
            }

            const reader = new FileReader();
            reader.onload = async function () {
                const newSong = {
                    path: reader.result,
                    displayName: songName,
                    cover: 'songs/2.jpg',
                    artist: 'Unknown Artist',
                    uploadDate: new Date().toISOString(),
                    hash: hash
                };

                await storeSong(newSong);
                await loadSongsFromDB();
                showNotification(`Song uploaded successfully: ${songName}`, 'success');
                displayPlaylist();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(`Error uploading song ${file.name}:`, error);
            showNotification(`Error uploading song: ${file.name}. Please try again.`, 'error');
        }
    }
}

// Notification Functions
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'notification-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'notification-dialog';

        const messageText = document.createElement('p');
        messageText.textContent = message;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notification-buttons';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'notification-btn confirm-btn';
        confirmBtn.textContent = 'Confirm';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'notification-btn cancel-btn';
        cancelBtn.textContent = 'Cancel';

        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(messageText);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const closeDialog = (result) => {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 300);
        };

        confirmBtn.addEventListener('click', () => closeDialog(true));
        cancelBtn.addEventListener('click', () => closeDialog(false));
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.innerHTML = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    const text = document.createElement('span');
    text.textContent = message;

    notification.appendChild(icon);
    notification.appendChild(text);
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Shuffle Function
function shuffleSongs() {
    const currentSong = songs[musicIndex];
    const remainingSongs = songs.filter((_, index) => index !== musicIndex);

    for (let i = remainingSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
    }

    songs = [currentSong, ...remainingSongs];
    musicIndex = 0;
    displayPlaylist();
}

// Event Listeners
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => changeMusic(-1));
nextBtn.addEventListener('click', () => changeMusic(1));
music.addEventListener('ended', () => changeMusic(1));
music.addEventListener('timeupdate', updateProgressBar);
playerProgress.addEventListener('click', setProgressBar);
closePlaylistBtn.addEventListener('click', togglePlaylist);
playlistBtn.addEventListener('click', togglePlaylist);
shuffleBtn.addEventListener('click', shuffleSongs);

uploadBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.multiple = true; // Allow multiple file selections
    fileInput.addEventListener('change', handleFileUpload);
    fileInput.click();
});
// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadSongsFromDB();
        loadMusic(songs[musicIndex]);
    } catch (error) {
        console.error('Error initializing database:', error);
        showNotification('Error loading songs. Please refresh the page.', 'error');
    }
});
window.onload = () => {
    document.addEventListener("keydown", (event) => {
        if (event.key === " ") {
            event.preventDefault();
            togglePlay();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            changeMusic(1);
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            changeMusic(-1);
        }
    });
};
function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.displayName,
            artist: song.artist,
            artwork: [{ src: song.cover, sizes: "512x512", type: "image/jpeg" }]
        });

        navigator.mediaSession.setActionHandler("play", playMusic);
        navigator.mediaSession.setActionHandler("pause", pauseMusic);
        navigator.mediaSession.setActionHandler("nexttrack", () => changeMusic(1));
        navigator.mediaSession.setActionHandler("previoustrack", () => changeMusic(-1));
    }
}
const style = document.createElement('style');
style.textContent = `
    #queue-section {
        margin-top: 24px;
        padding: 0 16px;
        color: #fff;
    }

    .queue-header {
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
        margin-top:5px
    }

    .queue-header h3 {
        font-size: 24px;
        margin: 0 0 4px 0;
    }

    .queue-subtitle {
        color: #b3b3b3;
        font-size: 14px;
    }

    #queue-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .queue-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .queue-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .queue-item-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .queue-cover {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        object-fit: cover;
    }

    .queue-text {
        display: flex;
        flex-direction: column;
    }

    .queue-title {
        font-size: 14px;
        color: #fff;
    }

    .queue-artist {
        font-size: 12px;
        color: #b3b3b3;
    }

    .remove-from-queue {
        background: none;
        border: none;
        color: #b3b3b3;
        cursor: pointer;
        padding: 8px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .queue-item:hover .remove-from-queue {
        opacity: 1;
    }

    .remove-from-queue:hover {
        color: #fff;
    }

    .empty-queue {
        text-align: center;
        color: #b3b3b3;
        font-size: 14px;
        padding: 24px 0;
        margin-top:-20px
    }
`;

document.head.appendChild(style);