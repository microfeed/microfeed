import {toast} from 'react-toastify';

export function showToast(message, type) {
  toast[type](message, {
    position: "top-center",
    autoClose: 800,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
}
