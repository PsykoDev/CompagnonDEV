/** @format */

const convertDate = (timestamp) => {
  var unixtimestamp = timestamp
  var months_arr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  var date = new Date(unixtimestamp * 1000)
  var year = date.getFullYear()
  var month = months_arr[date.getMonth()]
  var day = date.getDate()
  var hours = date.getHours()
  var minutes = "0" + date.getMinutes()
  var seconds = "0" + date.getSeconds()
  var convdataTime = day + "-" + month + "-" + year + " " + hours + ":" + minutes.substr(-2) + ":" + seconds.substr(-2)
  return convdataTime
}

module.exports = convertDate
