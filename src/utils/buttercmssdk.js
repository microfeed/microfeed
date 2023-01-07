import Butter from 'buttercms';

export let butterCMS;

try {
  const butterCmsPreview = !(process.env.REACT_APP_BUTTER_CMS_PREVIEW === "false" || process.env.REACT_APP_BUTTER_CMS_PREVIEW === "0")
  
  butterCMS = Butter(process.env.REACT_APP_BUTTER_CMS_API_KEY, butterCmsPreview);
} catch (error) {
  console.error(error)
}


