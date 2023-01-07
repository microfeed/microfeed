import React from "react"
import { Link } from "react-router-dom"
import BlogPostTile from "./BlogPostTile"

const BlogSection = (props) => {
  return (
    <section id="blog" className="blog-section">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-6 col-md-10">
            <div className="section-title text-center">
              <h2>Latest Blog Posts</h2>
              <p>Butter also has a built in blog engine which makes it dead simple
                to launch a new company blog.
              </p>
              <p>
                <Link
                  to="/blog"
                  className="main-btn btn-hover mt-5">View All Blog Posts
                </Link>
              </p>
            </div>
          </div>
        </div>
        <div className="row justify-content-center">
          {props.blogPosts.map(blogPost => <BlogPostTile key={blogPost.url} {...blogPost} />)}
        </div>
      </div>
    </section>
  )
}

export default BlogSection;
