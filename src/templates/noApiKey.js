import React from "react"
import Layout from "../containers/Layout"
import NoApiTokenSection from "../components/NoApiTokenSection"

const NoApiKeyPage = () => {
  return (
    <Layout menuItems={[]}>
      <NoApiTokenSection />
    </Layout>
)
}

export default NoApiKeyPage
