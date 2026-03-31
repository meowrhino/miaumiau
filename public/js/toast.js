// Notificaciones toast minimalistas
function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.hidden = false
  clearTimeout(el._t)
  el._t = setTimeout(() => el.hidden = true, duration)
}
