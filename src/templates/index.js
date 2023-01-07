import React, { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import Layout from "../containers/Layout"
import FeaturesSection from "../components/FeaturesSection"
import HeroSection from "../components/HeroSection"
import TestimonialsSection from "../components/TestimonialsSection"
import BlogSection from "../components/BlogSection"
import TwoColumnWithImageSection from "../components/TwoColumnWithImageSection"
import NotFoundSection from "../components/NotFoundSection"
import SEO from "../components/SEO";
import Spinner from "../components/Spinner";
import { butterCMS } from "../utils/buttercmssdk";
import { useMenuItems } from "../utils/hooks";

const IndexPage = () => {
  const [error, setError] = useState(false);
  const [loader, setLoader] = useState(true);
  const [page, setPage] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const { slug } = useParams();

  let menuItems = useMenuItems();

  useEffect(() => {
    const loadData = async () => {
      try {
        const page = await butterCMS.page.retrieve("landing-page", slug || "landing-page-with-components")
        setPage(page.data.data)
      } catch (error) {
        setError(true)
      }

      // Returns a list of published posts. The posts are returned sorted by publish date, with the most recent posts appearing first.
      const posts = await butterCMS.post.list({ page: 1, page_size: 2 })
      setBlogPosts(posts.data.data)
      setLoader(false);
    }

    loadData()
  }, []);

  if (error) return (<NotFoundSection />)
  if (loader) return (<Spinner />)

  return (
    <Layout menuItems={menuItems}>
      <SEO {...page.fields.seo} />

      {page.fields.body.map((bodyElement, i) => {
        switch (bodyElement.type) {
          case "hero":
            return <HeroSection fields={bodyElement.fields} key={i} />
          case "two_column_with_image":
            return <TwoColumnWithImageSection fields={bodyElement.fields} key={i} />
          case "features":
            return <FeaturesSection fields={bodyElement.fields} key={i} />
          case "testimonials":
            return <TestimonialsSection fields={bodyElement.fields} key={i} />
          default:
            return null
        }
      })}

      <BlogSection blogPosts={blogPosts} />
    </Layout>
  )
}

export default IndexPage
