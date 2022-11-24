import {toast} from 'react-toastify';

export function showToast(message, type, autoClose = 800) {
  toast[type](message, {
    position: "top-center",
    autoClose,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "colored",
  });
}
