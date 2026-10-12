import axios from 'axios'

// Use whatever host the page was loaded from (localhost, a LAN IP, etc.)
// instead of hardcoding 'localhost', so this works whether you open the
// app locally or from another device on the network.
const apiHost = window.location.hostname
const client = axios.create({
  baseURL: `http://${apiHost}:8000`,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('attendify_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('attendify_token')
      localStorage.removeItem('attendify_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
