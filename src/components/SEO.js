import * as React from "react"
import { Helmet, HelmetProvider } from 'react-helmet-async';

const SEO = ({ title, description, image }) => {
  return (
    <HelmetProvider>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {image && <meta name="image" content={image} />}
      </Helmet>
    </HelmetProvider>
  )
}

export default SEO;
