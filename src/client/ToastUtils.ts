import {toast} from 'react-toastify';

export function showToast(message: any, type: any, autoClose: any = 800) {
  (toast as any)[type](message, {
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
