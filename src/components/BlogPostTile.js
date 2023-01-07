import React from "react"
import { Link } from "react-router-dom"

const BlogPostTile = (props) => {
  return (
    <div className="col-lg-4 col-md-8 col-sm-10">
      <div className="single-blog">
        {props.featured_image &&
          <div className="blog-header">
            <img
              className="img-fluid"
              loading="lazy"
              src={props.featured_image}
              alt={props.featured_image_alt}
            />
          </div>}
        <div className="blog-body">
          <h5 className="package-name"><Link to={`/blog/${props.slug}`}>{props.title}</Link></h5>
          <p>{props.summary}</p>
        </div>
        <div className="blog-footer">
          <Link to={`/blog/${props.slug}`} className="main-btn btn-hover">Read More</Link>
        </div>
      </div>
    </div>
  )
}

export default BlogPostTile;
