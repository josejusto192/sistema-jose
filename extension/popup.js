const loginForm = document.getElementById('loginForm')
const loggedIn = document.getElementById('loggedIn')
const errorEl = document.getElementById('error')

async function render() {
  const { ok, data } = await chrome.runtime.sendMessage({ type: 'GET_SESSION' })
  if (ok && data) {
    loginForm.style.display = 'none'
    loggedIn.style.display = 'block'
    document.getElementById('userEmail').textContent = data.user?.email || ''
  } else {
    loginForm.style.display = 'block'
    loggedIn.style.display = 'none'
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  const btn = document.getElementById('loginBtn')
  errorEl.textContent = ''
  if (!email || !password) {
    errorEl.textContent = 'Preencha e-mail e senha.'
    return
  }
  btn.disabled = true
  btn.textContent = 'Entrando...'
  const res = await chrome.runtime.sendMessage({ type: 'LOGIN', email, password })
  btn.disabled = false
  btn.textContent = 'Entrar'
  if (!res.ok) {
    errorEl.textContent = res.error || 'Falha no login.'
    return
  }
  render()
})

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' })
  render()
})

render()
