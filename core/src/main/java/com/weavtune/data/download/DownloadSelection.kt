package com.weavtune.data.download

import com.weavtune.data.isYouTubeId
import com.weavtune.data.model.Song

/** A playlist can contain duplicates, device files, completed songs and pending jobs. */
data class DownloadSelection(val wanted: List<Song>, val stored: Set<String>, val active: Set<String>, val complete: Set<String>)

fun downloadSelection(songs: List<Song>, entries: Map<String, DownloadEntry>): DownloadSelection {
    val wanted = songs.filter { isYouTubeId(it.videoId) }.distinctBy { it.videoId }
    val ids = wanted.map { it.videoId }
    return DownloadSelection(wanted,
        ids.filterTo(linkedSetOf()) { it in entries },
        ids.filterTo(linkedSetOf()) { entries[it]?.state in setOf(DownloadState.QUEUED, DownloadState.DOWNLOADING) },
        ids.filterTo(linkedSetOf()) { entries[it]?.state == DownloadState.DONE })
}
