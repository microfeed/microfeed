import { useEffect, useState } from "react"
import { butterCMS } from "./buttercmssdk";

// load menu items data
export const useMenuItems = () => {
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    const loadData = async () => { 
      const menuItems = await butterCMS.content.retrieve(["navigation_menu"]);
      setMenuItems(menuItems.data.data.navigation_menu[0].menu_items)
    }

    loadData()
  }, []);

  return menuItems
}

// load categories
export const useCategories = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadData = async () => { 
      const categories = await butterCMS.category.list()
      setCategories(categories.data.data)
    }

    loadData()
  }, []);

  return categories
}
