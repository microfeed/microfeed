const requestPost = (url, bodyDict) => {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    'body': JSON.stringify(bodyDict),
  }).then((response) => response.json());
};

const Requests = {
  post: requestPost,
};

export default Requests;
