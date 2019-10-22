setwd('~/public_html/VTHYME/VirtualTYME_level1/data/')

###### Split csv files by subactivity and create smaller files

split_by_subactivity <- function(source, destination) {
  #source <- 'Drink producers/drinks.csv'
  #destination <- 'Drink producers/'
  
  food <- read.table(source, sep=',', header = T, stringsAsFactors = F, quote = '"')
  food <- food[order(food$subactivity),]
  garbage <- sapply(split(food, food$subactivity), function(x) {
    #x <- split(food, food$subactivity)[[1]]
    name <- gsub(pattern = "[,/]", replacement = ' ', unique(x$subactivity))
    name <- gsub(pattern = "  ", replacement = ' ', name)
    name <- gsub(pattern = ";", replacement = ' &', name)
    name <- gsub(pattern = " and ", replacement = ' & ', name)
    print(name)
    write.table(x[,colnames(x) != "subactivity"], file = paste(sep='', destination, name, '.csv'), sep=',', quote = F, row.names = F)
  })
}

split_by_subactivity('../bdc_data_source_csv/Food producers v2.csv', 'food producers/')
split_by_subactivity('../bdc_data_source_csv/Drinks producers v2.csv', 'drink producers/')

###### Now build the config ###################

data_path <- 'food producers/'

build_config_text <- function(data_path, toc_parent) {
  
  # filename,toc_parent,toc_name,file_type,geom_type,default_display,line_colour,line_width,icon
  confile <- data.frame(list.files(data_path))
  colnames(confile) <- 'filename'
  confile$toc_parent <- toc_parent
  confile$name <- gsub(pattern = ".csv", replacement = '', confile$filename)
  confile$filename <- paste(sep='', 'data/', data_path, confile$filename)
  confile$file_type <- "csv"
  confile$geom_type <- "point"
  confile$default_display<- "no"
  confile$line_colour <- ""
  confile$line_width <- ""
  confile$icon <- paste("data/icons/", confile$name, '.png', sep='')
  
  head(confile)
  
  write.table(confile, file=paste(data_path, "config_creator_helper.csv", sep=''), sep=',', quote=F, row.names = F)
}
                                                                                                                                                                      