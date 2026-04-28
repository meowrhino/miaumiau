// Events — calendar from public/data/events.json (sesión 9, MVP).
// On login we check if today has an event → speech bubble + toast.
// Pet menu's "eventos" button opens a modal with the next 30 days.
;(function () {
  const Events = {
    list: [],
    loaded: false,

    async load() {
      if (Events.loaded) return Events.list
      try {
        const r = await fetch('/data/events.json', { cache: 'no-cache' })
        if (!r.ok) throw new Error('events.json missing')
        Events.list = await r.json()
      } catch (_) {
        Events.list = []
      }
      Events.loaded = true
      return Events.list
    },

    today() {
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    },

    upcoming(days = 30) {
      const today = Events.today()
      const horizon = new Date(); horizon.setDate(horizon.getDate() + days)
      return Events.list
        .filter(e => e.date >= today && new Date(e.date) <= horizon)
        .sort((a, b) => a.date.localeCompare(b.date))
    },

    todayEvent() {
      const today = Events.today()
      return Events.list.find(e => e.date === today) || null
    },

    // Called once on app boot — if today has an event, nudge the user.
    async announceTodayIfAny() {
      await Events.load()
      const ev = Events.todayEvent()
      if (!ev) return
      // Don't re-announce more than once per day per user
      const key = 'miau_event_seen_' + ev.date
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      if (typeof showToast === 'function') showToast(`${ev.emoji || '📅'} ${ev.title}`, 4200)
      if (window.Pet && Pet.say) setTimeout(() => Pet.say(`¡hoy es ${ev.title}!`, 3000), 700)
    },

    openModal() {
      Events.bind()
      Events.load().then(() => {
        const modal = document.getElementById('eventsModal')
        const list  = document.getElementById('eventsList')
        if (!modal || !list) return
        const items = Events.upcoming(30)
        if (!items.length) {
          list.innerHTML = `<p class="events-empty">no hay eventos próximos. paz total.</p>`
        } else {
          list.innerHTML = items.map(ev => {
            const days = Events.daysFromToday(ev.date)
            const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`
            return `
              <article class="event-row${days === 0 ? ' is-today' : ''}">
                <span class="event-emoji">${ev.emoji || '📅'}</span>
                <div class="event-body">
                  <h3 class="event-title">${escText(ev.title)}</h3>
                  <p class="event-desc">${escText(ev.desc || '')}</p>
                  <span class="event-when">${when} · ${Events.fmtDate(ev.date)}</span>
                </div>
              </article>
            `
          }).join('')
        }
        modal.hidden = false
        requestAnimationFrame(() => modal.classList.add('open'))
      })
    },

    closeModal() {
      const modal = document.getElementById('eventsModal')
      if (!modal || modal.hidden) return
      modal.classList.remove('open')
      setTimeout(() => { modal.hidden = true }, 220)
    },

    bind() {
      const modal = document.getElementById('eventsModal')
      if (!modal || modal._bound) return
      modal._bound = true
      modal.addEventListener('click', e => { if (e.target === modal) Events.closeModal() })
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.hidden) Events.closeModal()
      })
    },

    daysFromToday(dateStr) {
      const a = new Date(Events.today() + 'T00:00:00')
      const b = new Date(dateStr + 'T00:00:00')
      return Math.round((b - a) / 86400000)
    },

    fmtDate(dateStr) {
      const d = new Date(dateStr + 'T00:00:00')
      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
      return `${d.getDate()} ${months[d.getMonth()]}`
    },
  }

  function escText(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
  }

  window.Events = Events
})()
