let musicList = [
    { title: "Song One", description: "Calm and relaxing", src: "music.mp3" },
    { title: "Song Two", description: "Upbeat and fun", src: "music2.mp3" }
];

let currentTrackIndex = 0;
let isPlaying = false;

const musicListDiv = document.getElementById("musicList");
const audioPlayer = document.getElementById("audioPlayer");
const currentTrack = document.getElementById("currentTrack");
const playPauseBtn = document.getElementById("playPauseBtn");

function renderMusicList() {
    musicListDiv.innerHTML = "";
    musicList.forEach((song, index) => {
        const div = document.createElement("div");
        div.classList.add("music-item");

        div.innerHTML = `
            <div class="music-info">
                <strong>${song.title}</strong><br>
                <small>${song.description}</small>
            </div>
            <button onclick="deleteTrack(${index})">🗑</button>
        `;

        div.addEventListener("click", () => playTrack(index));
        musicListDiv.appendChild(div);
    });
}

function playTrack(index) {
    currentTrackIndex = index;
    audioPlayer.src = musicList[index].src;
    currentTrack.textContent = `Playing: ${musicList[index].title}`;
    audioPlayer.play();
    isPlaying = true;
    playPauseBtn.textContent = "⏸ Pause";
}

function togglePlayPause() {
    if (isPlaying) {
        audioPlayer.pause();
        playPauseBtn.textContent = "▶ Play";
    } else {
        audioPlayer.play();
        playPauseBtn.textContent = "⏸ Pause";
    }
    isPlaying = !isPlaying;
}

function nextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % musicList.length;
    playTrack(currentTrackIndex);
}

function prevTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + musicList.length) % musicList.length;
    playTrack(currentTrackIndex);
}

function deleteTrack(index) {
    musicList.splice(index, 1);
    renderMusicList();
}

document.getElementById("addMusicBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const songTitle = prompt("Enter song title:", file.name);
        const songDesc = prompt("Enter description:", "New song");
        musicList.push({ title: songTitle, description: songDesc, src: url });
        renderMusicList();
    }
});

playPauseBtn.addEventListener("click", togglePlayPause);
document.getElementById("nextBtn").addEventListener("click", nextTrack);
document.getElementById("prevBtn").addEventListener("click", prevTrack);

renderMusicList();
