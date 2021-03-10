/** @format */

const UploadServerURLs = ["http://localhost/"]

const tryUploadSession = async function tryUploadSession(LogData, OnSuccess, OnError, ServerIndex = 0) {
  try {
    const res = await fetch(UploadServerURLs[ServerIndex] + "upload.php", { method: "PUT", body: LogData })
    if (!res.ok) throw Error(`Upload failed with code ${res.status} (${res.statusText})`)

    const data = await res.text()
    if (data !== "OK") throw Error(`Upload failed (${data})`)

    OnSuccess(LogData, ServerIndex)
  } catch (_) {
    // Try the next server
    if (ServerIndex + 1 < UploadServerURLs.length) await tryUploadSession(LogData, OnSuccess, OnError, ServerIndex + 1)
    else OnError(LogData, ServerIndex)
  }
}

module.exports = tryUploadSession
